import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setIdentity } from "../store/slices/bookingSlice";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";

// Step 3 — verification, Peachy-style: after the time is picked, the
// patient either verifies their email with a 6-digit code (the same
// passwordless OTP Mi Cuenta uses) or continues as a guest. Verified
// patients skip the details form when their info is already saved;
// guests fill it out and verify later via the emailed link, exactly
// as before.
//
// The OTP calls mirror pages/Login.tsx (same templates, same Spanish
// error strings). The magic link in the code email points at
// /mi-cuenta/ like the login does: clicking it signs the patient in
// in a new tab, the session lands here through the auth listener,
// and the effect below advances the flow.
export default function Verificar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const draftEmail = useAppSelector((s) => s.booking.customer.email);

  const [email, setEmail] = useState(draftEmail);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A session (already signed in, or just verified) means the
  // identity is proven: record it and move to the details step,
  // which skips ahead to revision when the info is complete.
  useEffect(() => {
    if (session) {
      dispatch(setIdentity("verified"));
      navigate("/reservar/datos", { replace: true });
    }
  }, [session, dispatch, navigate]);

  function continueAsGuest() {
    dispatch(setIdentity("guest"));
    navigate("/reservar/datos");
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/mi-cuenta/`,
      },
    });
    setBusy(false);
    if (error) {
      setError(
        "No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.",
      );
      return;
    }
    setStep("code");
  }

  async function resendCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/mi-cuenta/`,
      },
    });
    setBusy(false);
    if (error) {
      setError(
        "No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.",
      );
      return;
    }
    setCode("");
    setNotice("Te enviamos un código nuevo. Revisa tu correo.");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(
        "El código no es válido o ya venció. Pide uno nuevo e inténtalo otra vez.",
      );
    }
    // On success the AuthProvider picks up the session and the
    // effect above advances the flow.
  }

  return (
    <section id="booking-flow-verificar">
      <div className="booking-confirmation-wrapper">
        <div className="booking-confirmation-container">
          <div className="booking-confirmation-content">
            <div className="booking-confirmation-header">
              <h1>Verifica tu correo</h1>
            </div>
            <div className="booking-confirmation-body">
              {step === "email" && (
                <>
                  <p className="booking-account-note">
                    Te enviamos un código de 6 dígitos para confirmar tu
                    correo. Si tu información ya está guardada, no tendrás
                    que llenar el formulario.
                  </p>
                  <form
                    className="customer-info-form"
                    onSubmit={(e) => void sendCode(e)}
                  >
                    <div className="form-group">
                      <label htmlFor="verify-email" className="form-label">
                        Email
                      </label>
                      <input
                        type="email"
                        id="verify-email"
                        name="email"
                        className="form-input"
                        placeholder="tucorreo@ejemplo.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {error && (
                      <p className="booking-form-error" role="alert">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="confirmation-btn"
                      disabled={busy || !email.trim()}
                    >
                      {busy ? "Enviando…" : "Enviarme el código"}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="booking-guest-btn"
                    onClick={continueAsGuest}
                  >
                    Continuar como invitado
                  </button>
                </>
              )}

              {step === "code" && (
                <>
                  <p className="booking-account-note">
                    Te enviamos un código a <strong>{email.trim()}</strong>.
                    Escríbelo aquí, o entra con el enlace del mismo correo.
                    Revisa también tu carpeta de spam.
                  </p>
                  <form
                    className="customer-info-form"
                    onSubmit={(e) => void verify(e)}
                  >
                    <div className="form-group">
                      <label htmlFor="verify-code" className="form-label">
                        Código de 6 dígitos
                      </label>
                      <input
                        id="verify-code"
                        name="code"
                        className="form-input"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        maxLength={6}
                        placeholder="123456"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, ""))
                        }
                      />
                    </div>
                    {error && (
                      <p className="booking-form-error" role="alert">
                        {error}
                      </p>
                    )}
                    {notice && (
                      <p className="booking-form-notice" role="status">
                        {notice}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="confirmation-btn"
                      disabled={busy || code.length < 6}
                    >
                      {busy ? "Verificando…" : "Verificar"}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="booking-guest-btn"
                    onClick={() => void resendCode()}
                    disabled={busy}
                  >
                    Reenviar código
                  </button>
                  <button
                    type="button"
                    className="booking-guest-btn"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Usar otro correo
                  </button>
                  <button
                    type="button"
                    className="booking-guest-btn"
                    onClick={continueAsGuest}
                  >
                    Continuar como invitado
                  </button>
                </>
              )}

              <button
                type="button"
                className="booking-back-link"
                onClick={() => navigate("/reservar/fecha-hora")}
              >
                ← Volver a fecha y hora
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
