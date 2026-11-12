import type { BookingService } from "../../lib/queries/bookingQueries";
import { SERVICE_DESCRIPTIONS, formatServicePrice } from "../constants";

// One selectable service card — same markup and classes as the static
// servicios page, so the booking styles apply unchanged. Clicking
// anywhere on the card toggles it; the +/✓ button is the same action.
export default function ServiceCard({
  service,
  selected,
  onToggle,
}: {
  service: BookingService;
  selected: boolean;
  onToggle: (slug: string) => void;
}) {
  const description = SERVICE_DESCRIPTIONS[service.slug];
  return (
    <div
      className={`booking-service-card${selected ? " selected" : ""}`}
      data-service-id={service.slug}
      onClick={() => onToggle(service.slug)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(service.slug);
        }
      }}
    >
      <div className="booking-service-content">
        <div className="booking-service-info">
          <h3 className="booking-service-name">{service.name}</h3>
          <p className="booking-service-duration">
            {service.durationMinutes} min
          </p>
          {description && (
            <p className="booking-service-description">{description}</p>
          )}
        </div>
        <div className="booking-service-footer">
          <span className="booking-service-price">
            {formatServicePrice({
              price: service.price,
              priceFrom: service.priceFrom,
              priceNote: service.priceNote,
            })}
          </span>
          <button
            className={`booking-service-add-btn${selected ? " selected" : ""}`}
            aria-label={selected ? "Quitar servicio" : "Agregar servicio"}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(service.slug);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {selected ? (
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : (
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
