export function parseClockTime(value: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(2000, 0, 15, hours, minutes, 0, 0);
}

export function formatClockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function displayClockTime(value: string, locale?: string): string {
  const time = parseClockTime(value);
  return time ? new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(time) : value;
}