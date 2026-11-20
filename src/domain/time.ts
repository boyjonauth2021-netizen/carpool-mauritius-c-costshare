const ZONE = "Indian/Mauritius";

export function mauritiusTodayIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `YYYY-MM-DDTHH:mm` as Mauritius civil time, which is UTC+4 all year. */
export function parseMauritiusLocal(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return null;
  const date = new Date(`${input}:00+04:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function mauritiusDayRange(dateStr: string): { earliest: Date; latest: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const earliest = new Date(`${dateStr}T00:00:00+04:00`);
  const latest = new Date(`${dateStr}T23:59:59+04:00`);
  if (Number.isNaN(earliest.getTime()) || Number.isNaN(latest.getTime())) return null;
  return { earliest, latest };
}

export function formatMauritius(date: Date, locale: "en" | "fr"): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-MU" : "en-GB", {
    timeZone: ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function addMauritiusDays(now: Date, days: number, hour: number, minute: number): Date {
  const iso = mauritiusTodayIso(now);
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days, hour - 4, minute, 0));
}
