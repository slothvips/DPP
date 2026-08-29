import type { JWT } from 'google-auth-library';
import * as gsheet from 'google-spreadsheet';
import type { HistoricalOperation, SyncOperation } from './d1.ts';

export type { SyncOperation } from './d1.ts';

const SHEET_TITLE = 'Operations';
const HEADERS = [
  'id',
  'clientId',
  'table',
  'type',
  'key',
  'payload',
  'timestamp',
  'serverTimestamp',
  'keyHash',
];
const LEGACY_HEADERS = ['id', 'table', 'type', 'key', 'payload', 'timestamp', 'serverTimestamp'];
const MAX_SHEET_CELL_CHARS = 3000;

export type SheetSchemaVersion = 'v1' | 'v2';

function hasExactHeaders(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && expected.every((header) => actual.includes(header));
}

export function detectSheetSchema(headers: string[]): SheetSchemaVersion {
  if (hasExactHeaders(headers, HEADERS)) return 'v2';
  if (hasExactHeaders(headers, LEGACY_HEADERS)) return 'v1';
  throw new Error('Operations Sheet header schema is unsupported');
}

export function getSheetReadOffset(cursor: number): number {
  return cursor > 0 ? cursor - 1 : 0;
}

export function serializeSheetPayload(payload: unknown): unknown {
  return typeof payload === 'object' ? JSON.stringify(payload) : payload;
}

export function parseSheetPayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

export class SheetsClient {
  private doc: gsheet.GoogleSpreadsheet;
  private maxRetries = 3;
  private baseDelay = 1000;

  constructor(spreadsheetId: string, auth: JWT) {
    this.doc = new gsheet.GoogleSpreadsheet(spreadsheetId, auth);
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const is429 = lastError.message.includes('429') || lastError.message.includes('rate');
        if (!is429 && attempt < this.maxRetries - 1) {
          throw lastError;
        }

        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private async getOrCreateSheet() {
    return await this.withRetry(async () => {
      try {
        await this.doc.loadInfo();
      } catch (e: unknown) {
        const error = e as Error;
        if (error.message.includes('404')) {
          throw new Error(`Spreadsheet not found: ${this.doc.spreadsheetId}`);
        }
        throw error;
      }

      let sheet = this.doc.sheetsByTitle[SHEET_TITLE];
      if (!sheet) {
        sheet = await this.doc.addSheet({ title: SHEET_TITLE, headerValues: HEADERS });
      } else {
        // Sheet exists, verify and initialize header row if needed
        await this.ensureHeaderRow(sheet);
      }
      return sheet;
    });
  }

  private async getReadOnlySheet(): Promise<{
    schema: SheetSchemaVersion;
    sheet: gsheet.GoogleSpreadsheetWorksheet;
  } | null> {
    return await this.withRetry(async () => {
      await this.doc.loadInfo();
      const sheet = this.doc.sheetsByTitle[SHEET_TITLE];
      if (!sheet) return null;
      await sheet.loadHeaderRow();
      return { schema: detectSheetSchema(sheet.headerValues || []), sheet };
    });
  }

  private async ensureHeaderRow(sheet: gsheet.GoogleSpreadsheetWorksheet): Promise<void> {
    // Reload sheet info to get current row count and header info
    await sheet.loadHeaderRow();

    // Check if header row is missing or empty by comparing header values
    const currentHeaders = sheet.headerValues || [];
    if (currentHeaders.length === 0) {
      await sheet.setHeaderRow(HEADERS);
    } else {
      const missingHeaders = HEADERS.filter((header) => !currentHeaders.includes(header));
      if (missingHeaders.length > 0) {
        await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
      }
    }
  }

  async appendRows(rows: SyncOperation[]): Promise<number> {
    const sheet = await this.getOrCreateSheet();
    const rawRows = rows.map((op) => ({
      ...op,
      payload: serializeSheetPayload(op.payload),
    }));

    for (const row of rawRows) {
      if (typeof row.payload === 'string' && row.payload.length > MAX_SHEET_CELL_CHARS) {
        throw new Error(`Operation ${row.id} exceeds the maximum payload size`);
      }
    }

    const addedRows = await sheet.addRows(
      rawRows as unknown as Array<Record<string, string | number | boolean>>
    );

    if (addedRows && addedRows.length > 0) {
      const lastRow = addedRows[addedRows.length - 1];
      return lastRow.rowNumber;
    }

    return sheet.rowCount;
  }

  async readRows(
    offset: number,
    limit = 100,
    options?: { requireSheet?: boolean }
  ): Promise<{
    ops: SyncOperation[];
    records: HistoricalOperation[];
    nextCursor: number;
  }> {
    return await this.withRetry(async () => {
      const readOnlySheet = await this.getReadOnlySheet();
      if (!readOnlySheet) {
        if (options?.requireSheet) {
          throw new Error(`Required Sheet not found: ${SHEET_TITLE}`);
        }
        return { ops: [], records: [], nextCursor: offset + 1 };
      }
      const { schema, sheet } = readOnlySheet;

      // Check if we are trying to read beyond the sheet bounds
      // sheet.rowCount includes headers. We assume 1 header row.
      const headerRowCount = 1;
      const startRowIndex = headerRowCount + offset;

      if (startRowIndex >= sheet.rowCount) {
        return { ops: [], records: [], nextCursor: offset + 1 };
      }

      // Adjust limit to prevent "exceeds grid limits" error
      const availableRows = sheet.rowCount - startRowIndex;
      const safeLimit = Math.min(limit, availableRows);

      let rows: gsheet.GoogleSpreadsheetRow[] | undefined;
      try {
        rows = await sheet.getRows({ offset, limit: safeLimit });
      } catch (e) {
        const error = e as Error;
        if (error.message.includes('exceeds grid limits')) {
          return { ops: [], records: [], nextCursor: offset + 1 };
        }
        throw error;
      }

      if (!rows || rows.length === 0) {
        return { ops: [], records: [], nextCursor: offset + 1 };
      }

      const records = (rows as gsheet.GoogleSpreadsheetRow[])
        .filter((row) => !!row && typeof row?.get === 'function')
        .map((row) => {
          const payloadStr = (row.get('payload') as string) || '';
          const payload = parseSheetPayload(payloadStr);
          return {
            serverSeq: row.rowNumber,
            operation: {
              id: (row.get('id') as string) || '',
              clientId:
                schema === 'v2'
                  ? (row.get('clientId') as string | undefined) || undefined
                  : undefined,
              table: (row.get('table') as string) || '',
              type: (row.get('type') as string) || '',
              key: (row.get('key') as string) || '',
              payload,
              timestamp: Number(row.get('timestamp') || 0),
              serverTimestamp: Number(row.get('serverTimestamp') || 0) || undefined,
              keyHash:
                schema === 'v2'
                  ? (row.get('keyHash') as string | undefined) || undefined
                  : undefined,
            },
          };
        });
      const ops = records.map(({ operation }) => operation);

      const lastRow = rows[rows.length - 1];
      const nextCursor = lastRow.rowNumber;

      return { ops, records, nextCursor };
    });
  }

  async findOperationsByIds(ids: string[]): Promise<SyncOperation[]> {
    const remaining = new Set(ids);
    const found: SyncOperation[] = [];
    let offset = 0;

    while (remaining.size > 0) {
      const page = await this.readRows(offset, 100);
      found.push(...page.ops.filter((operation) => remaining.delete(operation.id)));
      if (page.ops.length === 0) break;
      const nextOffset = page.nextCursor > 0 ? page.nextCursor - 1 : offset + page.ops.length;
      if (nextOffset <= offset) break;
      offset = nextOffset;
    }

    return found;
  }
}
