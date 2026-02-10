import type { JWT } from 'google-auth-library';
import * as gsheet from 'google-spreadsheet';

export interface SyncOperation {
  id: string;
  table: string;
  type: string;
  key: string;
  payload: unknown;
  timestamp: number;
  serverTimestamp?: number;
  keyHash?: string;
}

const SHEET_TITLE = 'Operations';
const HEADERS = [
  'id',
  'table',
  'type',
  'key',
  'payload',
  'timestamp',
  'serverTimestamp',
  'keyHash',
];

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

  private async ensureHeaderRow(sheet: gsheet.GoogleSpreadsheetWorksheet): Promise<void> {
    // Reload sheet info to get current row count and header info
    await sheet.loadHeaderRow();

    // Check if header row is missing or empty by comparing header values
    const currentHeaders = sheet.headerValues || [];
    const headersMatch =
      currentHeaders.length === HEADERS.length &&
      HEADERS.every((header, index) => currentHeaders[index] === header);

    if (!headersMatch) {
      // Header row is missing or incorrect, set it
      await sheet.setHeaderRow(HEADERS);
    }
  }

  async appendRows(rows: SyncOperation[]): Promise<number> {
    return await this.withRetry(async () => {
      const sheet = await this.getOrCreateSheet();
      const rawRows = rows.map((op) => ({
        ...op,
        payload: typeof op.payload === 'object' ? JSON.stringify(op.payload) : op.payload,
      }));

      const addedRows = await sheet.addRows(
        rawRows as unknown as Array<Record<string, string | number | boolean>>
      );

      if (addedRows && addedRows.length > 0) {
        const lastRow = addedRows[addedRows.length - 1];
        return lastRow.rowNumber;
      }

      return sheet.rowCount;
    });
  }

  async readRows(
    offset: number,
    limit = 100
  ): Promise<{ ops: SyncOperation[]; nextCursor: number }> {
    return await this.withRetry(async () => {
      const sheet = await this.getOrCreateSheet();

      // Check if we are trying to read beyond the sheet bounds
      // sheet.rowCount includes headers. We assume 1 header row.
      const headerRowCount = 1;
      const startRowIndex = headerRowCount + offset;

      if (startRowIndex >= sheet.rowCount) {
        return { ops: [], nextCursor: offset + 1 };
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
          return { ops: [], nextCursor: offset + 1 };
        }
        throw error;
      }

      if (!rows || rows.length === 0) {
        return { ops: [], nextCursor: offset + 1 };
      }

      const ops = (rows as gsheet.GoogleSpreadsheetRow[])
        .filter((row) => !!row && typeof row?.get === 'function')
        .map((row) => {
          const payloadStr = (row.get('payload') as string) || '';
          let payload: unknown;
          try {
            payload = JSON.parse(payloadStr);
          } catch {
            payload = payloadStr;
          }
          return {
            id: (row.get('id') as string) || '',
            table: (row.get('table') as string) || '',
            type: (row.get('type') as string) || '',
            key: (row.get('key') as string) || '',
            payload,
            timestamp: Number(row.get('timestamp') || 0),
            serverTimestamp: Number(row.get('serverTimestamp') || 0) || undefined,
            keyHash: (row.get('keyHash') as string | undefined) || undefined,
          };
        });

      const lastRow = rows[rows.length - 1];
      const nextCursor = lastRow.rowNumber;

      return { ops, nextCursor };
    });
  }
}
