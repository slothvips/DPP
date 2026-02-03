import { JWT } from 'google-auth-library';

export interface Env {
  GOOGLE_SERVICE_ACCOUNT: string;
  SYNC_ACCESS_TOKEN: string;
}

export function getAuthToken(env: Env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  }
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);

  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return client;
}
