import { useEffect, useId, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearPromo,
  removeService,
  setPromo,
  setPromoError,
} from "../../store/slices/bookingSlice";
import type { BookingService } from "../../lib/queries/bookingQueries";
import { calcBookingTotals, formatServicePrice } from "../constants";
import { formatPrice } from "../../lib/format";
import { validatePromo, type PromoValidation } from "../../lib/api";

// The cart summary shared by the servicios, fecha-hora and datos
// steps: desktop sidebar + mobile bottom bar with the expandable
// panel. Same markup and classes as the static pages. Totals switch
// to "Total estimado" when any cart item carries a "desde" or
// per-unit price.
//
// The continue button varies per step: servicios/fecha-hora show it
// in both the sidebar and the bottom bar ("Continuar"); datos shows
// only the bottom-bar button ("Reservar Cita") because the form
// carries its own submit button. The caller owns the disabled rule.
//
// Promo codes (migration 008): the promo box lives in the sidebar
// AND in the mobile bottom panel (the sidebar is hidden on phones),
// both bound to the same Redux state. The applied percent is
// advisory — the server re-validates at submit — and the code is
// re-checked whenever the picked date changes, because the validity
// window compares against the appointment date. A code that stops
// being usable keeps showing with its error and blocks Continue
// until the patient removes it.

function promoReasonText(reason: PromoValidation["reason"]): string {
  if (reason === "expired")
    return "Ese código no aplica para la fecha elegida.";
  if (reason === "exhausted")
    return "Ese código ya llegó a su límite de usos.";
  return "Ese código no es válido. Revisa el código e inténtalo de nuevo.";
}

function PromoBox() {
  const dispatch = useAppDispatch();
  const promo = useAppSelector((s) => s.booking.promo);
  const promoError = useAppSelector((s) => s.booking.promoError);
  const date = useAppSelector((s) => s.booking.date);
  const inputId = useId();
  const [codeInput, setCodeInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function apply() {
    const code = codeInput.trim().toUpperCase();
    if (!code || checking) return;
    setChecking(true);
    setApplyError(null);
    try {
      const res = await validatePromo(code, date);
      if (res === null) {
        setApplyError("No pudimos verificar el código. Inténtalo de nuevo.");
        return;
      }
      if (!res.valid) {
        setApplyError(promoReasonText(res.reason));
        return;
      }
      dispatch(
        setPromo({ code, discountPercent: res.discountPercent ?? 0 }),
      );
      setCodeInput("");
    } finally {
      setChecking(false);
    }
  }

  if (promo) {
    if (promoError) {
      return (
        <div className="booking-promo-box">
          <label className="booking-promo-label">
            ¿Tienes un código promocional?
          </label>
          <div className="booking-promo-error-box" role="alert">
            <span className="booking-promo-error-text">
              {promo.code} · {promoError}
            </span>
            <button
              className="booking-promo-remove"
              type="button"
              aria-label="Quitar código promocional"
              onClick={() => dispatch(clearPromo())}
            >
              ×
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="booking-promo-box">
        <label className="booking-promo-label">
          ¿Tienes un código promocional?
        </label>
        <div className="booking-promo-applied">
          <span className="booking-promo-applied-text">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {promo.code} aplicado · −{promo.discountPercent}%
          </span>
          <button
            className="booking-promo-remove"
            type="button"
            aria-label="Quitar código promocional"
            onClick={() => dispatch(clearPromo())}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-promo-box">
      <label className="booking-promo-label" htmlFor={inputId}>
        ¿Tienes un código promocional?
      </label>
      <div className="booking-promo-row">
        <input
          id={inputId}
          className="booking-promo-input"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
          placeholder="Código promocional"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="booking-promo-apply-btn"
          type="button"
          disabled={!codeInput.trim() || checking}
          onClick={() => void apply()}
        >
          {checking ? "Verificando…" : "Aplicar"}
        </button>
      </div>
      {applyError && (
        <p className="booking-promo-apply-error" role="alert">
          {applyError}
        </p>
      )}
    </div>
  );
}

export default function CartSummary({
  catalog,
  onContinue,
  continueLabel = "Continuar",
  continueDisabled,
  showDesktopContinue = true,
}: {
  catalog: BookingService[];
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showDesktopContinue?: boolean;
}) {
  const dispatch = useAppDispatch();
  const services = useAppSelector((s) => s.booking.services);
  const promo = useAppSelector((s) => s.booking.promo);
  const promoError = useAppSelector((s) => s.booking.promoError);
  const date = useAppSelector((s) => s.booking.date);
  const [panelOpen, setPanelOpen] = useState(false);

  // Re-validate the applied code whenever the picked date changes:
  // the validity window compares against the appointment date, and
  // the date is chosen after the code can first be applied. Only the
  // error flag is updated here — the percent shown is the one from
  // the apply-time check, and the server applies the current percent
  // at submit. A transport failure keeps the last known state.
  const promoCode = promo?.code ?? null;
  useEffect(() => {
    if (!promoCode) return;
    let cancelled = false;
    void validatePromo(promoCode, date).then((res) => {
      if (cancelled || res === null) return;
      if (res.valid) {
        dispatch(setPromoError(null));
      } else {
        dispatch(setPromoError(promoReasonText(res.reason)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [promoCode, date, dispatch]);

  const bySlug = new Map(catalog.map((s) => [s.slug, s]));
  const entries = Object.entries(services)
    .map(([slug, quantity]) => ({ service: bySlug.get(slug), quantity }))
    .filter((e): e is { service: BookingService; quantity: number } =>
      Boolean(e.service),
    );
  const totals = calcBookingTotals(services, catalog);
  const empty = entries.length === 0;
  const promoApplies = Boolean(promo) && promoError === null;
  const discount = promoApplies
    ? Math.round((totals.total * (promo?.discountPercent ?? 0)) / 100)
    : 0;
  const finalTotal = totals.total - discount;
  const disabled = (continueDisabled ?? empty) || promoError !== null;

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

  const discountRow = promoApplies && promo && (
    <div className="booking-cart-row booking-cart-row--discount">
      <span>Descuento ({promo.code}):</span>
      <span>−{formatPrice(discount)}</span>
    </div>
  );

  return (
    <>
      <aside className="booking-cart-sidebar booking-cart-sidebar-desktop">
        <div className="booking-cart-header">
          <h2 className="booking-cart-title">Resumen de Cita</h2>
        </div>
        <div className="booking-cart-items">{cartItems}</div>
        {!empty && <PromoBox />}
        <div className="booking-cart-summary">
          <div className="booking-cart-row">
            <span>Subtotal:</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
          {discountRow}
          <div className="booking-cart-row booking-cart-total">
            <span>{totals.hasEstimate ? "Total estimado:" : "Total:"}</span>
            <span>{formatPrice(finalTotal)}</span>
          </div>
          <p className="booking-cart-estimate-note" hidden={!totals.hasEstimate}>
            Total estimado: los precios «desde» y por ampolla pueden variar. El
            precio final se confirma en tu evaluación.
          </p>
        </div>
        {showDesktopContinue && (
          <button
            className="booking-cart-continue-btn"
            id="continue-btn-desktop"
            disabled={disabled}
            type="button"
            onClick={onContinue}
          >
            {continueLabel}
          </button>
        )}
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
                {formatPrice(finalTotal)}
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
            id="continue-btn-mobile"
            disabled={disabled}
            type="button"
            onClick={onContinue}
          >
            {continueLabel}
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
          {!empty && <PromoBox />}
          <div className="booking-cart-bottom-panel-footer">
            <hr className="booking-cart-divider" />
            <div className="booking-cart-bottom-panel-total">
              <span>Subtotal</span>
              <span>{formatPrice(totals.total)}</span>
            </div>
            {promoApplies && promo && (
              <div className="booking-cart-bottom-panel-total booking-cart-row--discount">
                <span>Descuento ({promo.code})</span>
                <span>−{formatPrice(discount)}</span>
              </div>
            )}
            <div className="booking-cart-bottom-panel-total">
              <span>{totals.hasEstimate ? "Total estimado" : "Total"}</span>
              <span>{formatPrice(finalTotal)}</span>
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
