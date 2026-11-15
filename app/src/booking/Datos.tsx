import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  clearIdentityFresh,
  setCustomer,
} from "../store/slices/bookingSlice";
import { useAuth } from "../auth";
import { formatPhoneNumber, isValidPhoneNumber } from "../lib/format";
import { useBookingCatalog } from "../lib/queries/bookingQueries";
import CartSummary from "./components/CartSummary";

// How many times Datos re-tries a failed patient link before giving
// up and showing the form unskipped (initial attempt + retries).
const MAX_LINK_RETRIES = 2;

// Step 4 — customer details. Form only: the submit lives on the
// revision step. Signed-in patients see their email prefilled and
// locked, with name/phone prefilled from the patient record; guests
// fill everything in. Verified patients whose info is already
// complete never see this form: the skip effect below sends them
// straight to revision the first time they arrive from the
// verification step (identityFresh), and never again, so coming
// back to edit always shows the form.
export default function Datos() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const booking = useAppSelector((s) => s.booking);
  const { session, user, patient, ensureLinked } = useAuth();
  const linkedFor = useAppSelector((s) => s.auth.linkedFor);
  const linkStatus = useAppSelector((s) => s.auth.linkStatus);
  const { data: catalog } = useBookingCatalog();

  const formRef = useRef<HTMLFormElement>(null);

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

  const customer = booking.customer;
  const valid =
    Boolean(customer.firstName.trim()) &&
    Boolean(customer.lastName.trim()) &&
    Boolean(customer.email.trim()) &&
    isValidPhoneNumber(customer.phone.trim());
  // A promo code that stopped being usable (the cart re-validates it
  // against the picked date) blocks continuing until the patient
  // removes it from the cart.
  const promoBlocked = Boolean(booking.promo && booking.promoError);

  // Bounded retry for the patient link: one failed portal-link call
  // (cold start, network blip) must not strand a verified patient on
  // an empty form. The budget is scoped to the signed-in user, so a
  // later sign-in gets a fresh one. Declared before the skip effect
  // so the retry count is current when the skip decision reads it.
  const linkRetryCount = useRef(0);
  const linkRetryFor = useRef<string | null>(null);
  useEffect(() => {
    if (!session || patient || linkStatus !== "error") return;
    if (linkRetryFor.current !== session.user.id) {
      linkRetryFor.current = session.user.id;
      linkRetryCount.current = 0;
    }
    if (linkRetryCount.current >= MAX_LINK_RETRIES) return;
    linkRetryCount.current += 1;
    ensureLinked();
  }, [session, patient, linkStatus, ensureLinked]);

  // Auto-skip, once: a verified patient arriving fresh from the
  // verification step with complete info goes straight to revision.
  // The decision waits for the patient link to SUCCEED (or for the
  // retries above to run out) and both prefills to settle — a bare
  // link error no longer consumes the fresh flag, so a transient
  // failure can't kill the skip for the whole visit. The flag is
  // consumed ONLY when navigating: on the commit where a prefill
  // lands, `valid` still holds the pre-prefill customer (the
  // prefill's re-render hasn't happened yet), so consuming here
  // would kill the skip on exactly the commit that enables it.
  // The flag is cleared instead by the first user keystroke (see
  // update()), so a patient who starts typing keeps the form.
  useEffect(() => {
    if (!booking.identityFresh) return;
    const linkExhausted =
      linkStatus === "error" &&
      linkRetryCount.current >= MAX_LINK_RETRIES;
    const linkDone =
      !session || linkedFor === session.user.id || linkExhausted;
    const prefillDone =
      !session ||
      (emailPrefilled.current && (!patient || patientPrefilled.current));
    if (!linkDone || !prefillDone) return;
    if (session && valid) {
      dispatch(clearIdentityFresh());
      navigate("/reservar/revision", { replace: true });
    }
  }, [
    booking.identityFresh,
    session,
    linkedFor,
    linkStatus,
    patient,
    valid,
    dispatch,
    navigate,
  ]);

  function update(field: keyof typeof customer, value: string) {
    // A keystroke means the patient took control of the form: the
    // fresh-arrival auto-skip must never yank them to revision
    // mid-typing. Prefill effects dispatch setCustomer directly and
    // leave the flag alone.
    dispatch(clearIdentityFresh());
    dispatch(setCustomer({ [field]: value }));
  }

  function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || promoBlocked) return;
    if (!booking.date || !booking.time) {
      navigate("/reservar/fecha-hora");
      return;
    }
    navigate("/reservar/revision");
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
              onSubmit={handleContinue}
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
                type="submit"
                className="confirmation-btn"
                id="confirm-btn"
                disabled={!valid || promoBlocked}
              >
                Continuar
              </button>
            </form>
          </div>
        </div>

        {catalog && (
          <CartSummary
            catalog={catalog}
            onContinue={() => formRef.current?.requestSubmit()}
            continueDisabled={!valid || promoBlocked}
            showDesktopContinue={false}
          />
        )}
      </div>
    </div>
    </section>
  );
}
