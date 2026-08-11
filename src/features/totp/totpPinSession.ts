/** 进程内解锁会话：刷新扩展后需重新输入 PIN */
let unlocked = false;

export function isTotpPinSessionUnlocked(): boolean {
  return unlocked;
}

export function setTotpPinSessionUnlocked(value: boolean): void {
  unlocked = value;
}

export function lockTotpPinSession(): void {
  unlocked = false;
}
