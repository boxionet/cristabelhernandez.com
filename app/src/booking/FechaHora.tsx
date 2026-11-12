import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setBookingDate, setBookingTime } from "../store/slices/bookingSlice";
import { clinicTodayISO } from "../lib/format";
import { useAvailability } from "../lib/queries/availability";
import { useBookingCatalog, useBookingDayRange } from "../lib/queries/bookingQueries";
import { calcBookingTotals } from "./constants";
import {
  addDaysISO,
  formatDateForDisplay,
  isWeekendISO,
  nextWeekdayISO,
} from "./dateUtils";
import DateCarousel, { initialCarouselWindow } from "./components/DateCarousel";
import CalendarModal from "./components/CalendarModal";
import TimeGrid from "./components/TimeGrid";
import CartSummary from "./components/CartSummary";

// Step 2 — pick a date and time. The carousel window starts at
// today−7 … today+7 and extends a week per arrow press. Day
// availability comes from the range query (open + has a slot for the
// cart's total duration); the slot grid for the picked day comes from
// the day query. A day with no offered slot shows the unavailable
// message with the next available day — never an enabled grid.
export default function FechaHora() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const booking = useAppSelector((s) => s.booking);
  const today = clinicTodayISO();

  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch: refetchCatalog } =
    useBookingCatalog();
  const totals = useMemo(
    () => calcBookingTotals(booking.services, catalog ?? []),
    [booking.services, catalog],
  );
  const duration = totals.durationMinutes > 0 ? totals.durationMinutes : 30;

  const [window, setWindow] = useState(() => initialCarouselWindow(today));
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Default to today when arriving without a picked date.
  useEffect(() => {
    if (!booking.date) dispatch(setBookingDate(today));
  }, [booking.date, today, dispatch]);

  const selectedDate = booking.date ?? today;

  // The range endpoint rejects past dates: clamp the window's start.
  const rangeFrom = window.startISO < today ? today : window.startISO;
  const dayRange = useBookingDayRange(rangeFrom, window.endISO, duration);
  const availability = useMemo(() => {
    const map = new Map<string, { open: boolean; available: boolean }>();
    for (const day of dayRange.data ?? []) {
      map.set(day.date, { open: day.open, available: day.available });
    }
    return map;
  }, [dayRange.data]);

  const staticUnavailable =
    selectedDate < today || isWeekendISO(selectedDate);
  const rangeInfo = availability.get(selectedDate);
  const rangeUnavailable =
    rangeInfo !== undefined && (!rangeInfo.open || !rangeInfo.available);

  // Only fetch slots for a day that could offer them; the range data
  // (when present) is authoritative, and a failed range fetch falls
  // back to the day fetch deciding.
  const slotsQuery = useAvailability(
    selectedDate,
    duration,
    !staticUnavailable && !rangeUnavailable,
  );
  const slotsLoading = slotsQuery.isLoading;
  const slotsFailed =
    !slotsQuery.isLoading && slotsQuery.data === null && slotsQuery.isFetched;
  const daySlots = slotsQuery.data;

  const noSlots =
    !staticUnavailable &&
    !rangeUnavailable &&
    !slotsLoading &&
    !slotsFailed &&
    daySlots !== undefined &&
    daySlots !== null &&
    (!daySlots.open || daySlots.slots.length === 0);
  const showUnavailable =
    staticUnavailable || rangeUnavailable || noSlots;

  function ensureWindowContains(dateISO: string) {
    setWindow((w) => ({
      startISO: dateISO < w.startISO ? dateISO : w.startISO,
      endISO: dateISO > w.endISO ? dateISO : w.endISO,
    }));
  }

  function selectDate(dateISO: string) {
    ensureWindowContains(dateISO);
    dispatch(setBookingDate(dateISO));
  }

  function extendWindow(direction: "prev" | "next") {
    setWindow((w) =>
      direction === "prev"
        ? { ...w, startISO: addDaysISO(w.startISO, -7) }
        : { ...w, endISO: addDaysISO(w.endISO, 7) },
    );
  }

  // Next available day: first available day in the loaded range data
  // after the selected date, else the next weekday (the static rule
  // the old page used — the slot fetch re-checks on arrival).
  const nextAvailable = useMemo(() => {
    const days = [...availability.entries()]
      .filter(([date, info]) => date > selectedDate && info.open && info.available)
      .map(([date]) => date)
      .sort();
    return days[0] ?? nextWeekdayISO(selectedDate);
  }, [availability, selectedDate]);

  return (
    <section id="booking-flow-date-time">
      <div className="booking-main-wrapper">
        <div className="booking-left-content">
          <div className="booking-header-top">
            <h1>Selecciona fecha y hora</h1>
            <button
              className="booking-calendar-btn"
              aria-label="Calendar"
              type="button"
              onClick={() => setCalendarOpen(true)}
            >
              <svg
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 0 1 1 1v1h10V3a1 1 0 1 1 2 0v1h3a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V3a1 1 0 0 1 1-1M9 6H6v4h20V6h-3v1a1 1 0 1 1-2 0V6H11v1a1 1 0 1 1-2 0zm17 6H6v14h20z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="booking-date-section">
            <h2>Selecciona una fecha</h2>
            <DateCarousel
              startISO={window.startISO}
              endISO={window.endISO}
              selectedISO={selectedDate}
              availability={availability}
              onExtend={extendWindow}
              onSelect={selectDate}
            />
          </div>

          {showUnavailable ? (
            <div className="booking-unavailable-message">
              <div className="booking-unavailable-content">
                <svg
                  className="booking-unavailable-icon"
                  width="80"
                  height="80"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="4"
                    y="6"
                    width="24"
                    height="22"
                    rx="2"
                    fill="url(#gradient)"
                    stroke="#E8E2D9"
                    strokeWidth="1"
                  />
                  <circle cx="10" cy="10" r="1.5" fill="#E8E2D9" />
                  <circle cx="16" cy="10" r="1.5" fill="#E8E2D9" />
                  <circle cx="22" cy="10" r="1.5" fill="#E8E2D9" />
                  <defs>
                    <linearGradient
                      id="gradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        style={{ stopColor: "#9CAD8E", stopOpacity: 1 }}
                      />
                      <stop
                        offset="100%"
                        style={{ stopColor: "#D4E4C8", stopOpacity: 1 }}
                      />
                    </linearGradient>
                  </defs>
                </svg>
                <h3 className="booking-unavailable-title">
                  Esta fecha no está disponible
                </h3>
                <p className="booking-unavailable-subtitle">
                  Disponible desde {formatDateForDisplay(nextAvailable)}
                </p>
                <button
                  className="booking-unavailable-btn"
                  type="button"
                  onClick={() => selectDate(nextAvailable)}
                >
                  Ir a la próxima fecha disponible
                </button>
              </div>
            </div>
          ) : (
            <TimeGrid
              slots={daySlots ? daySlots.slots : null}
              selectedTime={booking.time}
              loading={slotsLoading}
              loadError={slotsFailed}
              onSelect={(time) => dispatch(setBookingTime(time))}
              onRetry={() => void slotsQuery.refetch()}
            />
          )}
        </div>

        {catalogLoading && (
          <p className="booking-cart-empty">Cargando tratamientos…</p>
        )}
        {catalogError && (
          <div>
            <p className="booking-cart-empty">
              No pudimos cargar los tratamientos. Por favor intenta de nuevo o
              llámanos al (829) 316-3313.
            </p>
            <button
              className="booking-cart-continue-btn"
              type="button"
              onClick={() => void refetchCatalog()}
            >
              Reintentar
            </button>
          </div>
        )}
        {catalog && (
          <CartSummary
            catalog={catalog}
            onContinue={() => navigate("/reservar/datos")}
            continueDisabled={!booking.date || !booking.time}
          />
        )}
      </div>

      <CalendarModal
        open={calendarOpen}
        selectedISO={selectedDate}
        onPick={selectDate}
        onClose={() => setCalendarOpen(false)}
      />
    </section>
  );
}
