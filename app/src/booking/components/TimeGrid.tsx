import { formatTime12h } from "../../lib/format";
import { STATIC_SLOT_TIMES_24H } from "../constants";

// The time-slot grid — same markup and classes as the static
// fecha-hora page, rendered from the engine's offered slots
// intersected with the static start-time grid (the clinic's offered
// set stays that grid, exactly as the static page behaved — it
// disabled grid slots the engine did not offer). No offered slot is
// ever rendered as selectable when the engine did not offer it.
// When the intersection is empty the grid would otherwise render
// blank, so an explicit empty message is shown instead.
export default function TimeGrid({
  slots,
  selectedTime,
  loading,
  loadError,
  onSelect,
  onRetry,
}: {
  /** Offered start times in 24h form, from the availability engine. */
  slots: string[] | null;
  selectedTime: string | null;
  loading: boolean;
  loadError: boolean;
  onSelect: (time24h: string) => void;
  onRetry: () => void;
}) {
  const offered = new Set(slots ?? []);
  const visible = STATIC_SLOT_TIMES_24H.filter((t) => offered.has(t));

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
            className="booking-time-grid"
            role="radiogroup"
            aria-orientation="vertical"
          >
            {visible.map((time24h) => {
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
