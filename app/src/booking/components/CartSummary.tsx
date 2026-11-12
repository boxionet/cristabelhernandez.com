import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { removeService } from "../../store/slices/bookingSlice";
import type { BookingService } from "../../lib/queries/bookingQueries";
import { calcBookingTotals, formatServicePrice } from "../constants";
import { formatPrice } from "../../lib/format";

// The servicios-step cart: desktop sidebar + mobile bottom bar with
// the expandable panel. Same markup and classes as the static page.
// Totals switch to "Total estimado" when any cart item carries a
// "desde" or per-unit price.
export default function CartSummary({
  catalog,
  onContinue,
}: {
  catalog: BookingService[];
  onContinue: () => void;
}) {
  const dispatch = useAppDispatch();
  const services = useAppSelector((s) => s.booking.services);
  const [panelOpen, setPanelOpen] = useState(false);

  const bySlug = new Map(catalog.map((s) => [s.slug, s]));
  const entries = Object.entries(services)
    .map(([slug, quantity]) => ({ service: bySlug.get(slug), quantity }))
    .filter((e): e is { service: BookingService; quantity: number } =>
      Boolean(e.service),
    );
  const totals = calcBookingTotals(services, catalog);
  const empty = entries.length === 0;

  const hours = Math.floor(totals.durationMinutes / 60);
  const mins = totals.durationMinutes % 60;
  let detailsText = `${totals.itemCount} item${totals.itemCount > 1 ? "s" : ""}`;
  if (hours > 0) detailsText += ` • ${hours}h`;
  if (mins > 0) detailsText += ` ${mins}m`;

  const cartItems = empty ? (
    <p className="booking-cart-empty">Selecciona un servicio para comenzar</p>
  ) : (
    entries.map(({ service, quantity }) => (
      <div className="booking-cart-item" key={service.slug}>
        <div className="booking-cart-item-content">
          <span className="booking-cart-item-name">{service.name}</span>
          <span className="booking-cart-item-duration">
            {service.durationMinutes} min
          </span>
        </div>
        <span className="booking-cart-item-price">
          {quantity > 1
            ? formatPrice(service.price * quantity)
            : formatServicePrice({
                price: service.price,
                priceFrom: service.priceFrom,
                priceNote: service.priceNote,
              })}
        </span>
        <button
          className="booking-cart-item-remove"
          aria-label="Eliminar servicio"
          type="button"
          onClick={() => dispatch(removeService(service.slug))}
        >
          ×
        </button>
      </div>
    ))
  );

  return (
    <>
      <aside className="booking-cart-sidebar booking-cart-sidebar-desktop">
        <div className="booking-cart-header">
          <h2 className="booking-cart-title">Resumen de Cita</h2>
        </div>
        <div className="booking-cart-items">{cartItems}</div>
        <div className="booking-cart-summary">
          <div className="booking-cart-row">
            <span>Subtotal:</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
          <div className="booking-cart-row booking-cart-total">
            <span>{totals.hasEstimate ? "Total estimado:" : "Total:"}</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
          <p className="booking-cart-estimate-note" hidden={!totals.hasEstimate}>
            Total estimado: los precios «desde» y por ampolla pueden variar. El
            precio final se confirma en tu evaluación.
          </p>
        </div>
        <button
          className="booking-cart-continue-btn"
          disabled={empty}
          type="button"
          onClick={onContinue}
        >
          Continuar
        </button>
      </aside>

      <div className={`booking-cart-bottom-bar${empty ? "" : " visible"}`}>
        <div className="booking-cart-bottom-content">
          <button
            className={`booking-cart-bottom-toggle${panelOpen ? " is-open" : ""}`}
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
          >
            <div className="booking-cart-bottom-info">
              <span className="booking-cart-bottom-price">
                {formatPrice(totals.total)}
              </span>
              <div className="booking-cart-bottom-details-row">
                <svg
                  className="booking-cart-bottom-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M27.768 7.359A1 1 0 0 0 27 7H6.835l-.611-3.357A2 2 0 0 0 4.256 2H2a1 1 0 0 0 0 2h2.25l3.195 17.536a3 3 0 0 0 .666 1.409A3.5 3.5 0 1 0 13.661 24h5.678a3.5 3.5 0 1 0 3.161-2H10.396a1 1 0 0 1-.984-.821L9.016 19h14.5a3 3 0 0 0 2.952-2.464l1.52-8.357a1 1 0 0 0-.22-.82M12 25.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m12 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m.5-9.321a1 1 0 0 1-.988.821H8.653L7.2 9H25.8z" />
                </svg>
                <span className="booking-cart-bottom-details">
                  {empty ? "0 items" : detailsText}
                </span>
              </div>
            </div>
            <svg
              className="booking-cart-toggle-arrow"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 15l-6-6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="booking-cart-bottom-continue-btn"
            disabled={empty}
            type="button"
            onClick={onContinue}
          >
            Continuar
          </button>
        </div>

        <div
          className={`booking-cart-bottom-panel${panelOpen ? " visible" : ""}`}
        >
          <div className="booking-cart-bottom-panel-header">
            <h2 className="booking-cart-bottom-panel-title">
              Desglose de precio
            </h2>
            <button
              className="booking-cart-bottom-panel-close"
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Cerrar desglose"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="booking-cart-bottom-panel-items">{cartItems}</div>
          <div className="booking-cart-bottom-panel-footer">
            <hr className="booking-cart-divider" />
            <div className="booking-cart-bottom-panel-total">
              <span>{totals.hasEstimate ? "Total estimado" : "Total"}</span>
              <span>{formatPrice(totals.total)}</span>
            </div>
            <p
              className="booking-cart-estimate-note"
              hidden={!totals.hasEstimate}
            >
              Total estimado: los precios «desde» y por ampolla pueden variar.
              El precio final se confirma en tu evaluación.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
