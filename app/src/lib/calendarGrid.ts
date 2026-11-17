// Pure month-grid math for the Panel's Días especiales calendar —
// kept dependency-free so the grid can be unit-tested outside the
// app, the way _booking/time.js is. Weeks start Monday, like the
// booking flow's CalendarModal.

const MONTHS_ES = [
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

export interface MonthGrid {
  /** YYYY-MM */
  key: string;
  /** "Noviembre de 2026" */
  title: string;
  /** Monday-first cells; null = blank filler (leading + trailing). */
  cells: (string | null)[];
}

export function buildMonthGrid(monthKey: string): MonthGrid {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Monday-first offset: Sunday (0) becomes 6, others shift down by 1.
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const leadBlanks = firstDow === 0 ? 6 : firstDow - 1;
  const cells: (string | null)[] = Array<string | null>(leadBlanks).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${monthKey}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return { key: monthKey, title: `${MONTHS_ES[m - 1]} de ${y}`, cells };
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** One readable sentence for a set of ISO dates, grouped by month so a
 *  cross-month selection still reads naturally:
 *  "18, 19, 20 y 25 de noviembre de 2026" or
 *  "30 de noviembre de 2026; 1 de diciembre de 2026". */
export function formatDayList(isos: string[]): string {
  const sorted = [...isos].sort();
  const groups = new Map<string, number[]>();
  for (const iso of sorted) {
    const key = iso.slice(0, 7);
    const days = groups.get(key) ?? [];
    days.push(Number(iso.slice(8, 10)));
    groups.set(key, days);
  }
  const parts: string[] = [];
  for (const [key, days] of groups) {
    const [y, m] = key.split("-").map(Number);
    const nums =
      days.length === 1
        ? `${days[0]}`
        : `${days.slice(0, -1).join(", ")} y ${days[days.length - 1]}`;
    parts.push(`${nums} de ${MONTHS_ES[m - 1].toLowerCase()} de ${y}`);
  }
  return parts.join("; ");
}
