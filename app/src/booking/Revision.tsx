import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  clearIdempotencyKey,
  clearPromo,
  setBookingResult,
  setCustomer,
  setIdempotencyKey,
} from "../store/slices/bookingSlice";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { createBooking } from "../lib/api";
import { trackBookingCompleted } from "../lib/analytics";
import {
  capitalizeFirst,
  formatDateEs,
  formatTime12h,
  isValidPhoneNumber,
} from "../lib/format";
import { useBookingCatalog } from "../lib/queries/bookingQueries";
import {
  RECAPTCHA_CONTAINER_ID,
  getCaptchaToken,
  warmCaptcha,
} from "../lib/recaptcha";
import CartSummary from "./components/CartSummary";

const GENERIC_ERROR =
  "No pudimos completar tu reserva. Por favor intenta de nuevo o llámanos al (829) 316-3313.";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "idem-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

// Step 5 — review + submit. The patient checks the appointment
// details and their contact info, optionally adds a note, and
// confirms. The submit is the same one the datos step used to own:
// signed-in patients book on their verified identity (no captcha),
// guests book behind the invisible captcha and verify by email.
export default function Revision() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const booking = useAppSelector((s) => s.booking);
  const { session, user, patient } = useAuth();
  const { data: catalog } = useBookingCatalog();

  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const signedIn = Boolean(session);

  // Warm the captcha widget so a guest submit is instant.
  useEffect(() => {
    void warmCaptcha();
  }, []);

  const customer = booking.customer;
  const valid =
    Boolean(customer.firstName.trim()) &&
    Boolean(customer.lastName.trim()) &&
    Boolean(customer.email.trim()) &&
    isValidPhoneNumber(customer.phone.trim());
  // A promo code that stopped being usable (the cart re-validates it
  // against the picked date) blocks submit until the patient removes
  // it from the cart.
  const promoBlocked = Boolean(booking.promo && booking.promoError);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !valid) return;
    if (promoBlocked) {
      setSubmitError(
        booking.promoError ??
          "El código promocional ya no es válido. Quítalo del resumen para continuar.",
      );
      return;
    }
    if (!booking.date || !booking.time) {
      navigate("/reservar/fecha-hora");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const idemKey = booking.idempotencyKey ?? newIdempotencyKey();
      if (!booking.idempotencyKey) dispatch(setIdempotencyKey(idemKey));
      const payload = {
        name: `${customer.firstName.trim()} ${customer.lastName.trim()}`,
        email: customer.email.trim(),
        phone: customer.phone.trim(),
        note: customer.note.trim(),
        items: Object.entries(booking.services).map(([slug, quantity]) => ({
          slug,
          quantity: quantity || 1,
        })),
        date: booking.date,
        startTime: booking.time,
        idempotencyKey: idemKey,
        promoCode: booking.promo?.code ?? null,
      };

      let created;
      const token = session?.access_token ?? null;
      if (token) {
        // Signed in: the booking rides the verified identity (no
        // captcha). A 401 means the session went stale mid-form —
        // fall back to one guest attempt rather than failing.
        created = await createBooking(payload, token);
        if (created.status === 401) {
          const captchaToken = await getCaptchaToken();
          created = await createBooking({ ...payload, captchaToken }, null);
        }
      } else {
        const captchaToken = await getCaptchaToken();
        created = await createBooking({ ...payload, captchaToken }, null);
      }

      if (created.ok) {
        const data = created.data;
        dispatch(
          setBookingResult({
            referenceCode: String(data.referenceCode ?? ""),
            status: String(data.status ?? ""),
            confirmationExpiresAt:
              typeof data.confirmationExpiresAt === "string"
                ? data.confirmationExpiresAt
                : null,
          }),
        );
        dispatch(clearIdempotencyKey());
        // One booking_completed event per successful submit, with
        // how the patient verified (verified/guest) — no patient
        // data. Fired here, not on the confirmation page, because
        // the draft (including the identity) is consumed on landing
        // there, and email-link landings must not count as bookings.
        trackBookingCompleted({
          identity: booking.identity,
          customerType: booking.customerType,
          serviceCount: Object.keys(booking.services).length,
        });
        navigate(`/reservar/confirmacion?ref=${data.referenceCode ?? ""}`);
        return;
      }
      if (created.status === 409) {
        dispatch(clearIdempotencyKey());
        toast.error("Ese horario acaba de ocuparse. Por favor elige otra hora.");
        navigate("/reservar/fecha-hora");
        return;
      }
      if (created.data.error === "date_in_past") {
        dispatch(clearIdempotencyKey());
        toast.error("Esa fecha ya pasó. Por favor elige otra fecha.");
        navigate("/reservar/fecha-hora");
        return;
      }
      if (created.status === 403) {
        setSubmitError(
          "No pudimos verificar que eres humano. Por favor intenta de nuevo.",
        );
        return;
      }
      if (
        created.data.error === "invalid_promo" ||
        created.data.error === "promo_exhausted"
      ) {
        // The code died between the cart check and the submit (the
        // server is authoritative). Drop it so the patient retries
        // cleanly, without losing the rest of the form.
        dispatch(clearPromo());
        setSubmitError(
          created.data.error === "promo_exhausted"
            ? "Ese código promocional ya llegó a su límite de usos. Lo quitamos del resumen; puedes reservar sin descuento."
            : "Ese código promocional ya no es válido. Lo quitamos del resumen; puedes reservar sin descuento.",
        );
        return;
      }
      setSubmitError(GENERIC_ERROR);
    } catch {
      setSubmitError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  const accountName = patient?.fullName || user?.email || "";
  const when =
    booking.date && booking.time
      ? `${capitalizeFirst(formatDateEs(booking.date))} · ${formatTime12h(`${booking.time}:00`)}`
      : "";

  return (
    <section id="booking-flow-revision">
      <div className="booking-confirmation-wrapper">
        <div className="booking-confirmation-container">
          <div className="booking-confirmation-content">
            <div className="booking-confirmation-header">
              <h1>Revisa tu cita</h1>
            </div>
            <div className="booking-confirmation-body">
              {signedIn ? (
                <p className="booking-account-note">
                  Reservando como <strong>{accountName}</strong> — esta cita
                  se guardará en tu cuenta.
                </p>
              ) : (
                <p className="booking-account-note">
                  Reservar sin cuenta — te enviaremos un correo para verificar
                  tu dirección.
                </p>
              )}

              <dl className="booking-review-details">
                <div className="booking-review-row">
                  <dt>Fecha y hora</dt>
                  <dd>{when}</dd>
                </div>
                <div className="booking-review-row">
                  <dt>Nombre</dt>
                  <dd>
                    {customer.firstName.trim()} {customer.lastName.trim()}
                  </dd>
                </div>
                <div className="booking-review-row">
                  <dt>Email</dt>
                  <dd>{customer.email.trim()}</dd>
                </div>
                <div className="booking-review-row">
                  <dt>Teléfono</dt>
                  <dd>{customer.phone.trim()}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="booking-review-edit"
                onClick={() => navigate("/reservar/datos")}
              >
                Editar mis datos
              </button>

              <form
                id="revision-form"
                className="customer-info-form"
                ref={formRef}
                onSubmit={handleSubmit}
                noValidate={false}
              >
                <div className="form-group">
                  <label htmlFor="note" className="form-label">
                    Nota (Opcional)
                  </label>
                  <textarea
                    id="note"
                    name="note"
                    className="form-input form-textarea"
                    placeholder="Agrega cualquier nota adicional sobre tu cita..."
                    rows={4}
                    value={customer.note}
                    onChange={(e) =>
                      dispatch(setCustomer({ note: e.target.value }))
                    }
                  />
                </div>

                {submitError && (
                  <p className="booking-form-error" role="alert">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  className="confirmation-btn"
                  id="confirm-btn"
                  disabled={!valid || submitting || promoBlocked}
                >
                  {submitting ? "Reservando…" : "Reservar Cita"}
                </button>
                <div id={RECAPTCHA_CONTAINER_ID} />
              </form>

              <button
                type="button"
                className="booking-back-link"
                onClick={() => navigate("/reservar/datos")}
              >
                ← Volver a tus datos
              </button>
            </div>
          </div>

          {catalog && (
            <CartSummary
              catalog={catalog}
              onContinue={() => formRef.current?.requestSubmit()}
              continueLabel="Reservar Cita"
              continueDisabled={!valid || submitting || promoBlocked}
              showDesktopContinue={false}
            />
          )}
        </div>
      </div>
    </section>
  );
}
