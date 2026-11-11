import { useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

/** Spanish month abbreviations, first letter capitalized (owner's pick). */
export const MONTHS_SHORT = [
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

/**
 * A month-granularity picker: a year header with arrows and the 12
 * months as tiles — the standard month-picker pattern (the unit you
 * pick is the unit you see; no day is ever shown as selected).
 * onPick receives the first day of the chosen month ("YYYY-MM-01").
 * Future months stay selectable (reports include booked revenue).
 */
export default function MonthGrid({
  value,
  onPick,
}: {
  /** "YYYY-MM-DD" — only its year/month are read. */
  value: string;
  onPick: (firstOfMonthIso: string) => void;
}) {
  const selectedYm = value ? value.slice(0, 7) : "";
  const initialYear = value
    ? Number(value.slice(0, 4))
    : new Date().getFullYear();
  const [year, setYear] = useState(initialYear);

  return (
    <div className="monthgrid">
      <div className="mg-head">
        <h3>{year}</h3>
        <div className="cal-nav">
          <button
            type="button"
            aria-label="Año anterior"
            onClick={() => setYear((y) => y - 1)}
          >
            <FiChevronLeft aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Año siguiente"
            onClick={() => setYear((y) => y + 1)}
          >
            <FiChevronRight aria-hidden />
          </button>
        </div>
      </div>
      <div className="mg-grid">
        {MONTHS_SHORT.map((name, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              key={ym}
              type="button"
              className={`mg-tile${ym === selectedYm ? " selected" : ""}`}
              onClick={() => onPick(`${ym}-01`)}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
