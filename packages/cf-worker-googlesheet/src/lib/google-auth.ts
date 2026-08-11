import { JWT } from 'google-auth-library';

export interface Env {
  GOOGLE_SERVICE_ACCOUNT: string;
  SYNC_ACCESS_TOKEN: string;
}

interface ServiceAccountCredentials {
  client_email?: string;
  private_key?: string;
}

function parseServiceAccount(raw: string): ServiceAccountCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT is not valid JSON. Re-put the full service account .json file contents.'
    );
  }

  // 兼容误把 JSON 再包一层字符串的情况
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT looks like a string, not a service account object. Re-put the raw .json file.'
      );
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT must be a JSON object from the service account key file.'
    );
  }

  return parsed as ServiceAccountCredentials;
}

export function getAuthToken(env: Env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  }

  const credentials = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT);

  if (!credentials.client_email) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT missing client_email. Use the full Google service account key JSON.'
    );
  }

  if (!credentials.private_key || typeof credentials.private_key !== 'string') {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT missing private_key. Use the full Google service account key JSON (not just client_email / spreadsheet id).'
    );
  }

  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return client;
}
