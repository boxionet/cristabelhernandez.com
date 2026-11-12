import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { consumeDraft } from "../store/slices/bookingSlice";
import { useBookingConfirmation } from "../lib/queries/bookingQueries";
import type { BookingSummary } from "../lib/api";
import {
  capitalizeFirst,
  formatDateEs,
  formatPrice,
  formatTime12h,
} from "../lib/format";
import { formatServicePrice } from "./constants";

// The confirmation page — server-driven. The summary comes from the
// booking-lookup function by reference code, so an emailed link
// shows the full appointment on ANY device (the old page showed
// empty placeholders without localStorage). Copy states port the
// static page's applyBookingState verbatim.

const CLINIC_NAME = "Dra. Cristabel Hernandez";
const CLINIC_ADDRESS =
  "Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata 57000, DO";
const CLINIC_PHONE = "(829) 316-3313";
// Puerto Plata is UTC-4 all year (no DST).
const CLINIC_UTC_OFFSET_MINUTES = 240;

function formatCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Google Calendar template URL for the appointment (calendar.js port).
 * The start instant is built from the clinic date/time in UTC, then
 * shifted by the clinic offset — correct in any viewer timezone
 * (the old page parsed the date in the browser's local zone). */
function buildGoogleCalendarUrl(summary: BookingSummary): string {
  const [y, m, d] = summary.date.split("-").map(Number);
  const [hh, mm] = summary.startTime.split(":").map(Number);
  const startUtc = new Date(
    Date.UTC(y, m - 1, d, hh, mm) + CLINIC_UTC_OFFSET_MINUTES * 60000,
  );
  const endUtc = new Date(
    startUtc.getTime() + summary.durationMinutes * 60000,
  );
  const serviceNames = summary.items.map((i) => i.service_name).join(", ");
  const detailsParts = [
    `Paciente: ${summary.patientName || "N/A"}`,
    `Servicios: ${serviceNames || "No especificado"}`,
    `Centro estético: ${CLINIC_NAME}`,
    `Teléfono: ${CLINIC_PHONE}`,
    `Dirección: ${CLINIC_ADDRESS}`,
    `Confirmación: ${summary.referenceCode}`,
  ];
  const text = encodeURIComponent(`Cita - ${CLINIC_NAME}`);
  const details = encodeURIComponent(detailsParts.join("\n"));
  const location = encodeURIComponent(CLINIC_ADDRESS);
  const dates = `${formatCalendarDate(startUtc)}/${formatCalendarDate(endUtc)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

function formatExpiry(instantISO: string): string {
  return new Date(instantISO).toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface CopyState {
  badge: string;
  title: string;
  sub1: string;
  sub2: string;
  showCard: boolean;
}

export default function Confirmacion() {
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const result = useAppSelector((s) => s.booking.result);

  const estado = params.get("estado");
  const ref = params.get("ref");

  // A fresh submit consumes the draft: Back can never re-submit the
  // same booking. The result stays for the copy below.
  const consumed = useMemo(() => Boolean(result), [result]);
  useEffect(() => {
    if (consumed) dispatch(consumeDraft());
  }, [consumed, dispatch]);

  const lookup = useBookingConfirmation(ref);
  const summary = lookup.data ?? null;

  // Copy: the ?estado= link landing wins; then the fresh-submit
  // result; then the fetched status (a refresh after submitting).
  const copy: CopyState = useMemo(() => {
    const refSuffix = ref ? ` (referencia ${ref})` : "";
    if (estado === "confirmada") {
      return {
        badge: "Cita confirmada",
        title: "¡Tu cita está confirmada!",
        sub1: `Tu cita quedó confirmada${refSuffix}. Te esperamos en el centro.`,
        sub2: "Si necesitas cambiar o cancelar, entra a Mi Cuenta o responde al correo de tu cita.",
        showCard: true,
      };
    }
    if (estado === "pendiente") {
      return {
        badge: "Pendiente de confirmación",
        title: "¡Gracias por verificar tu correo!",
        sub1: `Tu cita${refSuffix} quedó registrada y pendiente de confirmación por el centro. Te enviaremos un correo cuando la doctora la confirme.`,
        sub2: "Si necesitas cambiar o cancelar, entra a Mi Cuenta o contáctanos.",
        showCard: true,
      };
    }
    if (estado === "expirada") {
      return {
        badge: "Enlace vencido",
        title: "El enlace venció",
        sub1: "El espacio que apartaste se liberó porque el enlace no se usó a tiempo.",
        sub2: "Puedes reservar de nuevo desde Reservar, o llamarnos y con gusto te ayudamos.",
        showCard: false,
      };
    }
    if (estado) {
      return {
        badge: "Enlace no válido",
        title: "Este enlace no es válido",
        sub1: "El enlace no se reconoce. Si tu cita ya fue confirmada, no necesitas hacer nada más.",
        sub2: "Ante cualquier duda, contáctanos y con gusto te ayudamos.",
        showCard: false,
      };
    }
    const status = result?.status ?? summary?.status ?? null;
    if (status === "por_confirmar") {
      const expiresAt =
        result?.confirmationExpiresAt ?? summary?.confirmationExpiresAt ?? null;
      const expiryText = expiresAt
        ? ` Tienes hasta el ${formatExpiry(expiresAt)} para confirmarla.`
        : "";
      return {
        badge: "Falta confirmar tu cita",
        title: "¡Tu cita está apartada!",
        sub1: `Te enviamos un correo con el botón «Verificar mi correo». Tu espacio queda apartado solo hasta que verifiques tu correo.${expiryText}`,
        sub2: `Referencia de tu cita: ${ref ?? result?.referenceCode ?? ""}. Si no verificas tu correo a tiempo, el espacio se libera automáticamente.`,
        showCard: true,
      };
    }
    return {
      badge: "Pendiente de confirmación",
      title: "¡Tu cita fue recibida!",
      sub1: "Hemos recibido tu solicitud de cita. En breve nos pondremos en contacto contigo para confirmar la fecha y hora seleccionadas.",
      sub2: `Hemos enviado un resumen de tu cita a tu correo electrónico.${ref ? ` Referencia de tu cita: ${ref}.` : ""}`,
      showCard: true,
    };
  }, [estado, ref, result, summary]);

  const showCard = copy.showCard && Boolean(ref);
  const cardLoading = showCard && lookup.isLoading;
  const cardFailed =
    showCard && !lookup.isLoading && (lookup.isError || summary === null);

  const datetimeText = summary
    ? `${capitalizeFirst(formatDateEs(summary.date))} · ${formatTime12h(`${summary.startTime}:00`)}`
    : "—";

  return (
    <section id="booking-confirmacion">
      <div className="confirmacion-wrapper">
        <div className="confirmacion-container">
          <div className="confirmacion-icon-wrap">
            <svg
              className="confirmacion-icon"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="28" cy="28" r="28" fill="#F5EFE6" />
              <path
                d="M17 28.5L24.5 36L39 21"
                stroke="#705D3F"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="confirmacion-heading">
            <span className="confirmacion-status-badge">
              <span className="confirmacion-status-dot"></span>{" "}
              {copy.badge}
            </span>
            <h1 className="confirmacion-title">{copy.title}</h1>
            <p className="confirmacion-subtitle">{copy.sub1}</p>
            <p className="confirmacion-subtitle">{copy.sub2}</p>
          </div>

          {showCard && cardLoading && (
            <p className="booking-cart-empty">Cargando el resumen de tu cita…</p>
          )}
          {showCard && cardFailed && (
            <div>
              <p className="booking-cart-empty">
                No pudimos cargar el resumen de tu cita. Tu referencia es{" "}
                <strong>{ref}</strong>; el resumen también llegó a tu correo.
              </p>
              <button
                className="booking-cart-continue-btn"
                type="button"
                onClick={() => void lookup.refetch()}
              >
                Reintentar
              </button>
            </div>
          )}
          {showCard && summary && (
            <div className="confirmacion-summary-card">
              <div className="confirmacion-summary-header">
                <h2 className="confirmacion-summary-title">Resumen de tu cita</h2>
              </div>
              <div className="confirmacion-summary-body">
                <div className="confirmacion-summary-row">
                  <div className="confirmacion-summary-icon-col" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="confirmacion-summary-info">
                    <span className="confirmacion-summary-label">Paciente</span>
                    <span className="confirmacion-summary-value">
                      {summary.patientName ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="confirmacion-summary-row">
                  <div className="confirmacion-summary-icon-col" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3 9h18M8 2v3M16 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="confirmacion-summary-info">
                    <span className="confirmacion-summary-label">Fecha y hora</span>
                    <span className="confirmacion-summary-value">{datetimeText}</span>
                  </div>
                </div>

                <div className="confirmacion-summary-row confirmacion-summary-row--services">
                  <div className="confirmacion-summary-icon-col" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 12h6M9 16h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M9 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="confirmacion-summary-info">
                    <span className="confirmacion-summary-label">Servicios</span>
                    <ul className="confirmacion-services-list">
                      {summary.items.map((item) => (
                        <li key={item.service_name}>
                          <span className="confirmacion-service-name">
                            {item.service_name}
                          </span>
                          <span className="confirmacion-service-price">
                            {item.quantity > 1
                              ? formatPrice(item.unit_price * item.quantity)
                              : formatServicePrice({
                                  price: item.unit_price,
                                  priceFrom: item.price_from,
                                  priceNote: item.price_note ?? "",
                                })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="confirmacion-summary-row confirmacion-summary-row--total">
                  <div className="confirmacion-summary-icon-col" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 7v1m0 8v1M9.5 9.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5c0 1.5-2.5 2.5-2.5 4m0 0v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="confirmacion-summary-info">
                    <span className="confirmacion-summary-label">
                      {summary.totalIsEstimate ? "Total estimado" : "Total"}
                    </span>
                    <span className="confirmacion-summary-value confirmacion-summary-value--total">
                      {formatPrice(summary.totalPrice)}
                    </span>
                  </div>
                </div>
                <p
                  className="booking-cart-estimate-note"
                  hidden={!summary.totalIsEstimate}
                >
                  Total estimado: los precios «desde» y por ampolla pueden
                  variar. El precio final se confirma en tu evaluación.
                </p>
              </div>
            </div>
          )}

          <div className="confirmacion-actions">
            <p className="confirmacion-calendar-heading">Agregar al calendario</p>
            <div className="confirmacion-calendar-row">
              <button
                className="confirmacion-action-btn confirmacion-action-btn--google"
                type="button"
                disabled={!summary}
                aria-disabled={!summary}
                onClick={() => {
                  if (!summary) return;
                  window.open(buildGoogleCalendarUrl(summary), "_blank", "noopener,noreferrer");
                }}
              >
                <span className="confirmacion-action-btn-icon" aria-hidden="true">
                  <svg data-name="Layer 1" height="32" id="Layer_1" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22,4.5v6H10v11H4V6.5a2.0059,2.0059,0,0,1,2-2Z" fill="#4285f4" />
                    <polygon fill="#ea4435" points="22 27.5 22 21.5 28 21.5 22 27.5" />
                    <rect fill="#ffba00" height="12" width="6" x="22" y="9.5" />
                    <rect fill="#00ac47" height="12" transform="translate(40.5 8.5) rotate(90)" width="6" x="13" y="18.5" />
                    <path d="M28,6.5v4H22v-6h4A2.0059,2.0059,0,0,1,28,6.5Z" fill="#0066da" />
                    <path d="M10,21.5v6H6a2.0059,2.0059,0,0,1-2-2v-4Z" fill="#188038" />
                    <path d="M15.69,17.09c0,.89-.66,1.79-2.15,1.79a3.0026,3.0026,0,0,1-1.52-.39l-.08-.06.29-.82.13.08a2.3554,2.3554,0,0,0,1.17.34,1.191,1.191,0,0,0,.88-.31.8586.8586,0,0,0,.25-.65c-.01-.73-.68-.99-1.31-.99h-.54v-.81h.54c.45,0,1.12-.22,1.12-.82,0-.45-.31-.71-.85-.71a1.8865,1.8865,0,0,0-1.04.34l-.14.1-.28-.79.07-.06a2.834,2.834,0,0,1,1.53-.45c1.19,0,1.72.73,1.72,1.45a1.4369,1.4369,0,0,1-.81,1.3A1.52,1.52,0,0,1,15.69,17.09Z" fill="#4285f4" />
                    <polygon fill="#4285f4" points="18.71 12.98 18.71 18.79 17.73 18.79 17.73 14 16.79 14.51 16.58 13.69 17.95 12.98 18.71 12.98" />
                  </svg>
                </span>
                <span>Google Calendario</span>
              </button>
            </div>

            <div className="confirmacion-contact-row">
              <a
                href="https://wa.me/18293163313?text=Hola%2C%20acabo%20de%20reservar%20una%20cita%20y%20quiero%20confirmar%20los%20detalles."
                className="confirmacion-action-btn confirmacion-action-btn--whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contactar por WhatsApp"
              >
                <span className="confirmacion-action-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                </span>
                <span>WhatsApp</span>
              </a>

              <a
                href="tel:+18293163313"
                className="confirmacion-action-btn confirmacion-action-btn--phone"
                aria-label="Llamar al centro"
              >
                <span className="confirmacion-action-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.18 12.7a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Llamar</span>
              </a>
            </div>
          </div>

          <a href="/" className="confirmacion-home-btn">
            Volver al inicio
          </a>
        </div>
      </div>
    </section>
  );
}
