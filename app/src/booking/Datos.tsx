import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  clearIdempotencyKey,
  setBookingResult,
  setCustomer,
  setIdempotencyKey,
} from "../store/slices/bookingSlice";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { createBooking } from "../lib/api";
import { useBookingCatalog } from "../lib/queries/bookingQueries";
import {
  RECAPTCHA_CONTAINER_ID,
  getCaptchaToken,
  warmCaptcha,
} from "../lib/recaptcha";
import CartSummary from "./components/CartSummary";

// Phone rules, ported verbatim from the static datos page: NANP
// (+1) numbers only, formatted as "+1 (829) 316-3313" or
// "(829) 316-3313" while typing; valid means exactly 10 digits
// (after the country code when present).
function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    if (digits.length <= 1) return "+" + digits;
    if (digits.length <= 4) return "+" + digits.slice(0, 1) + " (" + digits.slice(1);
    if (digits.length <= 7) {
      return "+" + digits.slice(0, 1) + " (" + digits.slice(1, 4) + ") " + digits.slice(4);
    }
    return (
      "+" + digits.slice(0, 1) + " (" + digits.slice(1, 4) + ") " +
      digits.slice(4, 7) + "-" + digits.slice(7, 11)
    );
  }
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length > 1) {
    const countryCode = digits.slice(0, 1);
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    if (digits.length <= 1) return "+" + countryCode;
    if (digits.length <= 4) return "+" + countryCode + " (" + areaCode;
    if (digits.length <= 7) return "+" + countryCode + " (" + areaCode + ") " + exchange;
    return "+" + countryCode + " (" + areaCode + ") " + exchange + "-" + line;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6, 10);
}

function isValidPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[^\d+]/g, "");
  const allDigits = cleaned.replace(/\D/g, "");
  if (cleaned.startsWith("+")) {
    if (allDigits.startsWith("1")) return allDigits.slice(1).length === 10;
    return false;
  }
  return allDigits.length === 10;
}

const GENERIC_ERROR =
  "No pudimos completar tu reserva. Por favor intenta de nuevo o llámanos al (829) 316-3313.";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "idem-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

// Step 3 — customer details + submit. Signed-in patients book on
// their verified identity (the server uses the session email, so the
// email field is prefilled and locked); guests book without an
// account behind the invisible captcha and verify by email. The
// form lives in the slice, so Back keeps what was typed.
export default function Datos() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const booking = useAppSelector((s) => s.booking);
  const { session, user, patient, ensureLinked } = useAuth();
  const { data: catalog } = useBookingCatalog();

  const formRef = useRef<HTMLFormElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const signedIn = Boolean(session);

  // Link the patient record for a signed-in visitor (the same link
  // Mi Cuenta runs) so the form can prefill from it. Booking itself
  // does not require the link — the RPC matches by verified email.
  useEffect(() => {
    if (session && !patient) ensureLinked();
  }, [session, patient, ensureLinked]);

  // Prefill once, filling only fields the patient has not typed in.
  // Email and name/phone resolve at different times: the session user
  // is available immediately, but the patient record only arrives
  // after ensureLinked() finishes. A single "done" flag would consume
  // the prefill on the email alone and starve the name/phone fill, so
  // each source gets its own flag and fills when its data lands.
  const emailPrefilled = useRef(false);
  const patientPrefilled = useRef(false);
  useEffect(() => {
    if (emailPrefilled.current || !user?.email) return;
    if (!booking.customer.email) {
      dispatch(setCustomer({ email: user.email }));
    }
    emailPrefilled.current = true;
  }, [user, booking.customer.email, dispatch]);
  useEffect(() => {
    if (patientPrefilled.current || !patient) return;
    const patch: Partial<typeof booking.customer> = {};
    const [first, ...rest] = (patient.fullName || "").trim().split(/\s+/);
    if (first && !booking.customer.firstName) patch.firstName = first;
    const last = rest.join(" ");
    if (last && !booking.customer.lastName) patch.lastName = last;
    if (patient.phone && !booking.customer.phone) {
      patch.phone = formatPhoneNumber(patient.phone);
    }
    if (Object.keys(patch).length > 0) {
      dispatch(setCustomer(patch));
    }
    patientPrefilled.current = true;
  }, [patient, booking.customer, dispatch]);

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

  function update(field: keyof typeof customer, value: string) {
    dispatch(setCustomer({ [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !valid) return;
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
      setSubmitError(GENERIC_ERROR);
    } catch {
      setSubmitError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  const accountName =
    patient?.fullName || user?.email || "";

  return (
    <section id="booking-flow-datos">
    <div className="booking-confirmation-wrapper">
      <div className="booking-confirmation-container">
        <div className="booking-confirmation-content">
          <div className="booking-confirmation-header">
            <h1>Completa tus datos</h1>
          </div>
          <div className="booking-confirmation-body">
            {signedIn ? (
              <p className="booking-account-note">
                Reservando como <strong>{accountName}</strong> — esta cita se
                guardará en tu cuenta.
              </p>
            ) : (
              <p className="booking-account-note">
                Reservar sin cuenta — te enviaremos un correo para verificar tu
                dirección.
              </p>
            )}
            <form
              id="customer-info-form"
              className="customer-info-form"
              ref={formRef}
              onSubmit={handleSubmit}
              noValidate={false}
            >
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName" className="form-label">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    className="form-input"
                    placeholder="Cristina"
                    required
                    value={customer.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName" className="form-label">
                    Apellido
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    className="form-input"
                    placeholder="García"
                    required
                    value={customer.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  placeholder="cristina.garcia@gmail.com"
                  required
                  disabled={signedIn}
                  value={customer.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Teléfono
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="form-input"
                  placeholder="(123) 456 - 7890"
                  pattern="[0-9+() -]+"
                  inputMode="tel"
                  required
                  value={customer.phone}
                  onChange={(e) => update("phone", formatPhoneNumber(e.target.value))}
                  onKeyPress={(e) => {
                    if (!/[0-9+\-() ]/.test(e.key)) e.preventDefault();
                  }}
                />
              </div>

              <button
                type="button"
                className="add-note-btn"
                id="add-note-btn"
                onClick={() => setNoteOpen((open) => !open)}
              >
                {noteOpen ? "- Cerrar Nota" : "+ Agregar Nota"}
              </button>

              <div
                className={`form-group note-group${noteOpen ? " visible" : ""}`}
                id="note-group"
              >
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
                  onChange={(e) => update("note", e.target.value)}
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
                disabled={!valid || submitting}
              >
                {submitting ? "Reservando…" : "Reservar Cita"}
              </button>
              <div id={RECAPTCHA_CONTAINER_ID} />
            </form>
          </div>
        </div>

        {catalog && (
          <CartSummary
            catalog={catalog}
            onContinue={() => formRef.current?.requestSubmit()}
            continueLabel="Reservar Cita"
            continueDisabled={!valid || submitting}
            showDesktopContinue={false}
          />
        )}
      </div>
    </div>
    </section>
  );
}
