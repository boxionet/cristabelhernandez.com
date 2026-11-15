import { useEffect, useRef } from "react";
import { clinicTodayISO } from "../../lib/format";
import {
  DAY_NAMES_SHORT,
  MONTH_NAMES_SHORT,
  addDaysISO,
  eachDayISO,
  isWeekendISO,
  weekdayOfISO,
} from "../dateUtils";

// The horizontal date strip — same markup and classes as the static
// fecha-hora page. The window starts at today−7 … today+7; the arrows
// extend it a week at a time. A tile is unavailable when the day is
// past, a weekend, or the availability range says it is closed or
// fully booked (when the range data is missing, the static
// weekend/past rule decides, and the slot fetch on selection is
// authoritative).
export default function DateCarousel({
  startISO,
  endISO,
  selectedISO,
  availability,
  onExtend,
  onSelect,
}: {
  startISO: string;
  endISO: string;
  selectedISO: string;
  /** date -> { open, available } from the range query (may be partial). */
  availability: Map<string, { open: boolean; available: boolean }>;
  onExtend: (direction: "prev" | "next") => void;
  onSelect: (dateISO: string) => void;
}) {
  const today = clinicTodayISO();
  const stripRef = useRef<HTMLDivElement>(null);
  const days = eachDayISO(startISO, endISO);

  // Keep the selected tile in view when the selection moves (e.g. a
  // calendar-modal pick outside the visible strip).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const tile = strip.querySelector<HTMLElement>(
      `[data-iso-date="${selectedISO}"]`,
    );
    tile?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedISO]);

  function isUnavailable(dateISO: string): boolean {
    if (dateISO < today) return true;
    if (isWeekendISO(dateISO)) return true;
    const info = availability.get(dateISO);
    if (info) return !info.open || !info.available;
    return false;
  }

  const chevron = (direction: "prev" | "next") => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={direction === "prev" ? "M15 18L9 12L15 6" : "M9 18L15 12L9 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="booking-date-controls">
      <button
        className="booking-date-prev"
        aria-label="Previous date"
        type="button"
        onClick={() => onExtend("prev")}
      >
        {chevron("prev")}
      </button>
      <div className="booking-date-carousel">
        <div className="booking-date-scrollable-inner" ref={stripRef}>
          {days.map((dateISO) => {
            const [, m, d] = dateISO.split("-").map(Number);
            const unavailable = isUnavailable(dateISO);
            const selected = dateISO === selectedISO;
            return (
              <div
                className="booking-date-tile-wrapper"
                data-item="true"
                data-iso-date={dateISO}
                data-selected={selected ? "true" : "false"}
                key={dateISO}
              >
                <button
                  type="button"
                  className={`booking-date-tile${selected ? " booking-date-tile--selected" : ""}${unavailable ? " booking-date-tile--unavailable" : ""}`}
                  aria-pressed={selected ? "true" : "false"}
                  aria-label={`Select ${DAY_NAMES_SHORT[weekdayOfISO(dateISO)]}, ${MONTH_NAMES_SHORT[m - 1]} ${d}`}
                  onClick={() => onSelect(dateISO)}
                >
                  <span className="booking-date-day">
                    {DAY_NAMES_SHORT[weekdayOfISO(dateISO)]}
                  </span>
                  <span className="booking-date-number">{d}</span>
                  <span className="booking-date-month">
                    {MONTH_NAMES_SHORT[m - 1]}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <button
        className="booking-date-next"
        aria-label="Next date"
        type="button"
        onClick={() => onExtend("next")}
      >
        {chevron("next")}
      </button>
    </div>
  );
}

// The initial carousel window: 7 days before today through 7 after.
export function initialCarouselWindow(todayISO: string): {
  startISO: string;
  endISO: string;
} {
  return {
    startISO: addDaysISO(todayISO, -7),
    endISO: addDaysISO(todayISO, 7),
  };
}
