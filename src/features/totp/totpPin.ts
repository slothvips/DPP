import { deleteSetting, getSetting, updateSetting } from '@/lib/db/settings';

export const TOTP_PIN_MIN_LENGTH = 4;
export const TOTP_PIN_MAX_LENGTH = 8;
export const DEFAULT_TOTP_PIN_ITERATIONS = 120_000;
export const DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES = 5;

export const TOTP_PIN_AUTO_LOCK_OPTIONS = [
  { value: 0, label: '仅离开时锁定' },
  { value: 1, label: '1 分钟空闲' },
  { value: 5, label: '5 分钟空闲' },
  { value: 15, label: '15 分钟空闲' },
  { value: 30, label: '30 分钟空闲' },
] as const;

export interface TotpPinConfig {
  enabled: boolean;
  autoLockMinutes: number;
  iterations: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function normalizeTotpPin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, TOTP_PIN_MAX_LENGTH);
}

export function isValidTotpPin(pin: string): boolean {
  return (
    /^\d+$/.test(pin) && pin.length >= TOTP_PIN_MIN_LENGTH && pin.length <= TOTP_PIN_MAX_LENGTH
  );
}

async function derivePinHash(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export async function getTotpPinConfig(): Promise<TotpPinConfig> {
  const [hash, autoLockMinutes, iterations] = await Promise.all([
    getSetting('totp_pin_hash'),
    getSetting('totp_pin_auto_lock_minutes'),
    getSetting('totp_pin_iterations'),
  ]);

  return {
    enabled: typeof hash === 'string' && hash.length > 0,
    autoLockMinutes:
      typeof autoLockMinutes === 'number' ? autoLockMinutes : DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES,
    iterations: typeof iterations === 'number' ? iterations : DEFAULT_TOTP_PIN_ITERATIONS,
  };
}

export async function verifyTotpPin(pin: string): Promise<boolean> {
  const normalized = normalizeTotpPin(pin);
  if (!isValidTotpPin(normalized)) return false;

  const [hash, salt, iterations] = await Promise.all([
    getSetting('totp_pin_hash'),
    getSetting('totp_pin_salt'),
    getSetting('totp_pin_iterations'),
  ]);

  if (!hash || !salt) return false;

  const derived = await derivePinHash(
    normalized,
    base64ToBytes(salt),
    typeof iterations === 'number' ? iterations : DEFAULT_TOTP_PIN_ITERATIONS
  );
  return derived === hash;
}

export async function setTotpPin(pin: string, autoLockMinutes?: number): Promise<void> {
  const normalized = normalizeTotpPin(pin);
  if (!isValidTotpPin(normalized)) {
    throw new Error(`PIN 需为 ${TOTP_PIN_MIN_LENGTH}–${TOTP_PIN_MAX_LENGTH} 位数字`);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = DEFAULT_TOTP_PIN_ITERATIONS;
  const hash = await derivePinHash(normalized, salt, iterations);
  const lockMinutes =
    typeof autoLockMinutes === 'number' ? autoLockMinutes : DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES;

  await Promise.all([
    updateSetting('totp_pin_hash', hash),
    updateSetting('totp_pin_salt', bytesToBase64(salt)),
    updateSetting('totp_pin_iterations', iterations),
    updateSetting('totp_pin_auto_lock_minutes', lockMinutes),
  ]);
}

export async function updateTotpPinAutoLockMinutes(minutes: number): Promise<void> {
  await updateSetting('totp_pin_auto_lock_minutes', minutes);
}

export async function clearTotpPin(): Promise<void> {
  await Promise.all([
    deleteSetting('totp_pin_hash'),
    deleteSetting('totp_pin_salt'),
    deleteSetting('totp_pin_iterations'),
    deleteSetting('totp_pin_auto_lock_minutes'),
  ]);
}
