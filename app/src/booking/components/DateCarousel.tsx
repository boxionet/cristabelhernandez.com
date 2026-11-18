import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clinicTodayISO } from "../../lib/format";
import {
  DAY_NAMES_SHORT,
  MONTH_NAMES_SHORT,
  addDaysISO,
  eachDayISO,
  weekdayOfISO,
} from "../dateUtils";

// The horizontal date strip, Fresha-style: a FIXED window of days
// (today through today+181) is rendered upfront — nothing is
// appended while scrolling. The chevrons sit above the strip, next
// to the label, and page the strip by exactly one visible width;
// each disables at its end. On phones the chevrons are hidden and
// the strip moves by swipe (see booking.css). A tile is unavailable
// when the day is past, or the availability range says it is closed
// or fully booked (when the range data is missing, the tile stays
// enabled and the slot fetch on selection is authoritative).
// Weekends follow the same rule — a Saturday the clinic opened with
// a short-hours exception shows as available.

// Days in the fixed strip, matching Fresha's ~6-month horizon. The
// range endpoint's guard (MAX_RANGE_DAYS) must cover this window.
export const CAROUSEL_WINDOW_DAYS = 182;

export function carouselWindow(todayISO: string): {
  startISO: string;
  endISO: string;
} {
  return {
    startISO: todayISO,
    endISO: addDaysISO(todayISO, CAROUSEL_WINDOW_DAYS - 1),
  };
}

export default function DateCarousel({
  startISO,
  endISO,
  selectedISO,
  availability,
  onSelect,
}: {
  startISO: string;
  endISO: string;
  selectedISO: string;
  /** date -> { open, available } from the range query (may be partial). */
  availability: Map<string, { open: boolean; available: boolean }>;
  onSelect: (dateISO: string) => void;
}) {
  const today = clinicTodayISO();
  const stripRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const days = useMemo(() => eachDayISO(startISO, endISO), [startISO, endISO]);

  // Chevron disabled states follow the scroll position: at the start
  // the left chevron disables, at the end the right one does.
  const updateEdges = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    setCanPrev(strip.scrollLeft > 2);
    setCanNext(strip.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    updateEdges();
  }, [updateEdges, days]);

  useEffect(() => {
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges]);

  // Keep the selected tile in view when the selection moves outside
  // the visible strip (e.g. a calendar-modal pick): it lands at the
  // left edge. A selection that is already visible never yanks the
  // strip, and scrolling never changes the selection.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const tile = strip.querySelector<HTMLElement>(
      `[data-iso-date="${selectedISO}"]`,
    );
    if (!tile) return;
    const stripRect = strip.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const visible =
      tileRect.left >= stripRect.left - 1 &&
      tileRect.right <= stripRect.right + 1;
    if (visible) return;
    tile.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  }, [selectedISO]);

  // One press pages the strip by exactly one visible width.
  function page(direction: "prev" | "next") {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction === "next" ? strip.clientWidth : -strip.clientWidth,
      behavior: "smooth",
    });
  }

  function isUnavailable(dateISO: string): boolean {
    if (dateISO < today) return true;
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
    <div className="booking-date-carousel-wrap">
      <div className="booking-date-carousel-head">
        <h2>Selecciona una fecha</h2>
        <div className="booking-date-carousel-arrows">
          <button
            className="booking-date-prev"
            aria-label="Previous date"
            type="button"
            disabled={!canPrev}
            onClick={() => page("prev")}
          >
            {chevron("prev")}
          </button>
          <button
            className="booking-date-next"
            aria-label="Next date"
            type="button"
            disabled={!canNext}
            onClick={() => page("next")}
          >
            {chevron("next")}
          </button>
        </div>
      </div>
      <div
        className="booking-date-carousel"
        ref={stripRef}
        onScroll={updateEdges}
      >
        <div className="booking-date-scrollable-inner">
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
    </div>
  );
}
