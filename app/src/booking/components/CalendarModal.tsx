import { useEffect, useState } from "react";
import { clinicTodayISO } from "../../lib/format";
import { MONTH_NAMES_LONG } from "../dateUtils";

// The month-grid jump calendar — same markup and classes as the
// static fecha-hora modal. Weeks start Monday. Only past days and
// days past the strip's last day (maxISO) are disabled; every day in
// between stays clickable, and the step's availability data decides
// whether it offers slots (a Saturday the clinic opened with a
// short-hours exception works like any day). Month paging stops at
// the current month and the month holding maxISO, so a pick always
// lands on a tile in the strip.
export default function CalendarModal({
  open,
  selectedISO,
  maxISO,
  onPick,
  onClose,
}: {
  open: boolean;
  selectedISO: string;
  maxISO: string;
  onPick: (dateISO: string) => void;
  onClose: () => void;
}) {
  const today = clinicTodayISO();
  const [month, setMonth] = useState(() => selectedISO.slice(0, 7));

  useEffect(() => {
    if (open) setMonth(selectedISO.slice(0, 7));
  }, [open, selectedISO]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const [year, monthNum] = month.split("-").map(Number);
  const minMonth = today.slice(0, 7);
  const maxMonth = maxISO.slice(0, 7);
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  // Monday-first offset: Sunday (0) becomes 6, others shift down by 1.
  const firstDow = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();
  const leadBlanks = firstDow === 0 ? 6 : firstDow - 1;

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    setMonth(`${y}-${m}`);
  }

  const chevron = (direction: "prev" | "next") => (
    <svg
      width="24"
      height="24"
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
    <div className="booking-calendar-modal active">
      <div className="booking-calendar-overlay" onClick={onClose} />
      <div
        className="booking-calendar-popup"
        role="dialog"
        aria-label="Elegir fecha"
      >
        <div className="booking-calendar-header">
          <button
            className="booking-calendar-prev"
            aria-label="Previous month"
            type="button"
            disabled={month <= minMonth}
            onClick={() => shiftMonth(-1)}
          >
            {chevron("prev")}
          </button>
          <h2 className="booking-calendar-title">
            {MONTH_NAMES_LONG[monthNum - 1]} {year}
          </h2>
          <button
            className="booking-calendar-next"
            aria-label="Next month"
            type="button"
            disabled={month >= maxMonth}
            onClick={() => shiftMonth(1)}
          >
            {chevron("next")}
          </button>
        </div>
        <div className="booking-calendar-weekdays">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((w) => (
            <div className="booking-calendar-weekday" key={w}>
              {w}
            </div>
          ))}
        </div>
        <div className="booking-calendar-days">
          {Array.from({ length: leadBlanks }).map((_, i) => (
            <div className="booking-calendar-day other-month" key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const iso = `${month}-${String(day).padStart(2, "0")}`;
            const isPast = iso < today;
            const isBeyond = iso > maxISO;
            const className = [
              "booking-calendar-day",
              iso === today ? "today" : "",
              iso === selectedISO ? "selected" : "",
              isPast || isBeyond ? "disabled" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={iso}
                type="button"
                className={className}
                disabled={isPast || isBeyond}
                onClick={() => {
                  onPick(iso);
                  onClose();
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
