export function getBeijingDate(offsetDays = 0): string {
  const now = new Date();
  const bjOffset = 8 * 60 * 60 * 1000;
  const bjTime = new Date(now.getTime() + bjOffset - offsetDays * 24 * 60 * 60 * 1000);

  const year = bjTime.getUTCFullYear();
  const month = String(bjTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bjTime.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getAvailableDates(): { label: string; value: string }[] {
  return [
    { label: '今天', value: getBeijingDate(0) },
    { label: '昨天', value: getBeijingDate(1) },
    { label: '前天', value: getBeijingDate(2) },
  ];
}
