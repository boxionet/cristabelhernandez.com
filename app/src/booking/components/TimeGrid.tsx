import { FiMoon, FiSun, FiSunrise } from "react-icons/fi";
import type { IconType } from "react-icons";
import { formatTime12h } from "../../lib/format";
import { STATIC_SLOT_TIMES_24H } from "../constants";

// The time-slot grid — same markup and classes as the static
// fecha-hora page, rendered from the engine's offered slots
// intersected with the static half-hourly start-time grid (the
// clinic's offered set stays that grid). No offered slot is
// ever rendered as selectable when the engine did not offer it.
// When the intersection is empty the grid would otherwise render
// blank, so an explicit empty message is shown instead.
//
// Slots render grouped under Mañana / Tarde / Noche (user decision
// 2026-11-19, design proposal v2), one radiogroup across all
// groups, same slot buttons and selected state as before. The
// per-group rule: a group with visible slots shows its header and
// grid; a group with no visible slots shows its header with a
// "no times available" message ONLY when the group's hours are
// covered by the day's open hours (openTime/closeTime from the day
// query) — i.e. the part is fully booked, not closed. When the
// group's hours are not covered, the group renders nothing at all.
// On a normal 09:00–18:00 day Noche never appears.
type DayPart = {
  key: string;
  label: string;
  icon: IconType;
  /** Inclusive lower bound of the part, "HH:MM". */
  start: string;
  /** Exclusive upper bound of the part, "HH:MM". */
  end: string;
  emptyMessage: string;
};

const DAY_PARTS: DayPart[] = [
  {
    key: "manana",
    label: "Mañana",
    icon: FiSunrise,
    start: "00:00",
    end: "12:00",
    emptyMessage: "No hay horarios disponibles en la mañana.",
  },
  {
    key: "tarde",
    label: "Tarde",
    icon: FiSun,
    start: "12:00",
    end: "18:00",
    emptyMessage: "No hay horarios disponibles en la tarde.",
  },
  {
    key: "noche",
    label: "Noche",
    icon: FiMoon,
    start: "18:00",
    end: "24:00",
    emptyMessage: "No hay horarios disponibles en la noche.",
  },
];

export default function TimeGrid({
  slots,
  selectedTime,
  loading,
  loadError,
  onSelect,
  onRetry,
  openTime,
  closeTime,
}: {
  /** Offered start times in 24h form, from the availability engine. */
  slots: string[] | null;
  selectedTime: string | null;
  loading: boolean;
  loadError: boolean;
  onSelect: (time24h: string) => void;
  onRetry: () => void;
  /** The day's open/close times ("HH:MM") from the day query; null when closed. */
  openTime?: string | null;
  /** The day's open/close times ("HH:MM") from the day query; null when closed. */
  closeTime?: string | null;
}) {
  const offered = new Set(slots ?? []);
  const visible = STATIC_SLOT_TIMES_24H.filter((t) => offered.has(t));

  // A part's hours are covered when the day's open window overlaps
  // the part's window at all ("HH:MM" compares lexicographically).
  // Without open/close times (an older response) nothing is
  // covered, so an empty group hides — the old behavior.
  const groups = DAY_PARTS.map((part) => ({
    ...part,
    slots: visible.filter((t) => t >= part.start && t < part.end),
    covered:
      Boolean(openTime) &&
      Boolean(closeTime) &&
      (openTime as string) < part.end &&
      (closeTime as string) > part.start,
  }));

  return (
    <div className="booking-time-section">
      <h2>Elige una hora</h2>
      {loading && (
        <p className="booking-cart-empty">Cargando horarios…</p>
      )}
      {!loading && loadError && (
        <div>
          <p className="booking-cart-empty">
            No pudimos cargar los horarios de este día. Por favor intenta de
            nuevo o llámanos al (829) 316-3313.
          </p>
          <button
            className="booking-cart-continue-btn"
            type="button"
            onClick={onRetry}
          >
            Reintentar
          </button>
        </div>
      )}
      {!loading && !loadError && visible.length === 0 && (
        <p className="booking-time-end-note">
          No hay horarios disponibles para este día. Prueba con otra
          fecha.
        </p>
      )}
      {!loading && !loadError && visible.length > 0 && (
        <>
          <div
            className="booking-time-groups"
            role="radiogroup"
            aria-orientation="vertical"
          >
            {groups.map((group) => {
              if (group.slots.length === 0 && !group.covered) return null;
              const Icon = group.icon;
              return (
                <section className="booking-time-group" key={group.key}>
                  <h3 className="booking-time-group-title">
                    <Icon size={20} aria-hidden="true" />
                    {group.label}
                  </h3>
                  {group.slots.length > 0 ? (
                    <div className="booking-time-grid">
                      {group.slots.map((time24h) => {
                        const label = formatTime12h(`${time24h}:00`);
                        const selected = selectedTime === time24h;
                        return (
                          <div
                            className="booking-time-slot-wrapper"
                            data-qa="timeslot"
                            key={time24h}
                          >
                            <button
                              type="button"
                              className={`booking-time-slot${selected ? " booking-time-slot--selected" : ""}`}
                              aria-pressed={selected ? "true" : "false"}
                              aria-live="polite"
                              onClick={() => onSelect(time24h)}
                            >
                              <p className="booking-time-slot-text">{label}</p>
                            </button>
                            <input
                              type="radio"
                              name="time-slot-selection"
                              value={label}
                              tabIndex={-1}
                              aria-live="polite"
                              aria-checked={selected ? "true" : "false"}
                              className="booking-time-input"
                              checked={selected}
                              readOnly
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="booking-time-group-empty">
                      {group.emptyMessage}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          {visible.length > 0 && (
            <p className="booking-time-end-note">
              No hay más horarios disponibles para este día. El último es
              a las{" "}
              {formatTime12h(`${visible[visible.length - 1]}:00`)}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
