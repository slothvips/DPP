export const MAX_PUSH_BODY_BYTES = 256 * 1024;

const MAX_JSON_DEPTH = 16;
const MAX_JSON_NODES = 5000;
const MAX_ARRAY_ITEMS = 1000;
const MAX_OBJECT_KEY_CHARS = 128;
const MAX_STRING_CHARS = 8192;

export class RequestTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTooLargeError';
  }
}

function validateJsonComplexity(value: unknown): void {
  const pending: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }];
  let nodes = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > MAX_JSON_NODES) throw new RequestTooLargeError('JSON node budget exceeded');
    if (current.depth > MAX_JSON_DEPTH) {
      throw new RequestTooLargeError('JSON nesting depth exceeded');
    }
    if (typeof current.value === 'string' && current.value.length > MAX_STRING_CHARS) {
      throw new RequestTooLargeError('JSON string length exceeded');
    }
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_ARRAY_ITEMS) {
        throw new RequestTooLargeError('JSON array item budget exceeded');
      }
      for (const child of current.value) {
        pending.push({ depth: current.depth + 1, value: child });
      }
      continue;
    }
    if (!current.value || typeof current.value !== 'object') continue;
    for (const [key, child] of Object.entries(current.value)) {
      if (key.length > MAX_OBJECT_KEY_CHARS) {
        throw new RequestTooLargeError('JSON object key length exceeded');
      }
      pending.push({ depth: current.depth + 1, value: child });
    }
  }
}

export async function readJsonBodyWithLimit(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      throw new SyntaxError('Invalid Content-Length');
    }
    if (parsedLength > MAX_PUSH_BODY_BYTES) {
      throw new RequestTooLargeError('Request body exceeds the maximum size');
    }
  }

  if (!request.body) throw new SyntaxError('Request body is required');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_PUSH_BODY_BYTES) {
      await reader.cancel();
      throw new RequestTooLargeError('Request body exceeds the maximum size');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  const body = JSON.parse(text) as unknown;
  validateJsonComplexity(body);
  return body;
}

export async function parsePushRequest(
  request: Request
): Promise<{ ops: unknown[]; clientId?: string }> {
  const body = await readJsonBodyWithLimit(request);
  if (typeof body !== 'object' || body === null) throw new SyntaxError('Invalid payload');
  const { ops, clientId } = body as { ops?: unknown; clientId?: unknown };
  if (!Array.isArray(ops)) throw new SyntaxError('Invalid payload');
  if (ops.length > 50) throw new RequestTooLargeError('Push batch exceeds 50 operations');
  if (
    clientId !== undefined &&
    (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 256)
  ) {
    throw new SyntaxError('Invalid clientId');
  }
  return { ops, clientId };
}
