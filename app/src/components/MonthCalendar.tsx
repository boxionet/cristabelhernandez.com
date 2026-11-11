import { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { clinicToday } from "../lib/panel";

const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The 42 ISO dates (6 Monday-first weeks) covering the given month. */
function monthCells(monthKey: string): string[] {
  const first = new Date(`${monthKey}-01T12:00:00Z`);
  const dow = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = shiftDate(`${monthKey}-01`, -dow);
  return Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
}

export function monthTitleOf(monthKey: string): string {
  const d = new Date(`${monthKey}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * The modern month calendar used across the Panel: the selected day is
 * a filled circle, today carries a ring, and picking a day never moves
 * the grid. `counts` optionally shows a per-day cita count.
 */
export default function MonthCalendar({
  value,
  onPick,
  counts,
}: {
  value: string;
  onPick: (iso: string) => void;
  counts?: Record<string, number>;
}) {
  const today = clinicToday();
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const cells = useMemo(() => monthCells(month), [month]);

  const pick = (d: string) => {
    onPick(d);
    if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7));
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <h3 className="cal-title">{monthTitleOf(month)}</h3>
        <div className="cal-nav">
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setMonth(today.slice(0, 7));
              onPick(today);
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            className="cal-arrow"
            aria-label="Mes anterior"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            className="cal-arrow"
            aria-label="Mes siguiente"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <FiChevronRight />
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {DOW.map((d) => (
          <span key={d} className="cal-dow">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const n = counts?.[d] ?? 0;
          const inMonth = d.slice(0, 7) === month;
          return (
            <button
              key={d}
              type="button"
              className={`cal-day${inMonth ? "" : " dim"}`}
              onClick={() => pick(d)}
            >
              <span
                className={`cal-num${d === value ? " selected" : ""}${d === today ? " today" : ""}`}
              >
                {Number(d.slice(8))}
              </span>
              {counts && (
                <span className={`cal-count${n === 0 ? " none" : ""}`}>
                  {n > 0 ? `${n} cita${n > 1 ? "s" : ""}` : "·"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
