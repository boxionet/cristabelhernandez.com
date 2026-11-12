// Clinic-timezone date helpers for the booking flow. All math runs
// on UTC-noon dates (the same trick lib/format.ts uses) so the
// browser's local timezone can never shift a clinic date.

export const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTH_NAMES_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
export const MONTH_NAMES_LONG = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
export const WEEKDAY_NAMES_LONG = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function parseISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function toISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  const date = parseISO(dateISO);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

/** 0 = Sunday … 6 = Saturday, for a clinic date. */
export function weekdayOfISO(dateISO: string): number {
  return parseISO(dateISO).getUTCDay();
}

export function isWeekendISO(dateISO: string): boolean {
  const day = weekdayOfISO(dateISO);
  return day === 0 || day === 6;
}

/** "Lunes, Noviembre 16" — the display form the static flow used. */
export function formatDateForDisplay(dateISO: string): string {
  const date = parseISO(dateISO);
  return `${WEEKDAY_NAMES_LONG[date.getUTCDay()]}, ${MONTH_NAMES_LONG[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** The next non-weekend day strictly after the given date. */
export function nextWeekdayISO(dateISO: string): string {
  let cursor = addDaysISO(dateISO, 1);
  while (isWeekendISO(cursor)) cursor = addDaysISO(cursor, 1);
  return cursor;
}

/** All dates from `from` to `to` inclusive (assumes from <= to). */
export function eachDayISO(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return days;
}
