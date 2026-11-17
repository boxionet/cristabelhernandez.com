// Pure date grouping for the Panel's Días especiales list — kept
// dependency-free (type-only import) so the split/group math can be
// unit-tested outside the app, the way _booking/time.js is.

import type { ExceptionRow } from "./panel";

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

export interface ExceptionMonthGroup {
  /** YYYY-MM */
  key: string;
  /** "Noviembre de 2026" */
  title: string;
  items: ExceptionRow[];
}

/**
 * Split exceptions into upcoming (today or later, oldest first) and
 * past (before today, most recent first — the Dra looks for what
 * just passed when she opens the collapsed past section).
 */
export function splitExceptions(
  exceptions: readonly ExceptionRow[],
  todayISO: string,
): { upcoming: ExceptionRow[]; past: ExceptionRow[] } {
  const sorted = [...exceptions].sort((a, b) => a.date.localeCompare(b.date));
  return {
    upcoming: sorted.filter((e) => e.date >= todayISO),
    past: sorted.filter((e) => e.date < todayISO).reverse(),
  };
}

/** Group date-sorted exceptions by calendar month, in order. */
export function groupExceptionsByMonth(
  items: readonly ExceptionRow[],
): ExceptionMonthGroup[] {
  const groups = new Map<string, ExceptionRow[]>();
  for (const e of items) {
    const key = e.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, groupItems]) => {
    const [y, m] = key.split("-").map(Number);
    return { key, title: `${MONTHS_ES[m - 1]} de ${y}`, items: groupItems };
  });
}
