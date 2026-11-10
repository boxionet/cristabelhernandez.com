import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/mi-cuenta/" replace />;

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/mi-cuenta/`,
      },
    });
    setBusy(false);
    if (error) {
      setError("No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.");
      return;
    }
    setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError("El código no es válido o ya venció. Pide uno nuevo e inténtalo otra vez.");
    }
    // On success the AuthProvider picks up the session and redirects.
  }

  return (
    <main className="login-wrap">
      <section className="card login-card">
        <div className="brand login-brand">
          <span className="brand-mark">CH</span>
          <span className="brand-text">
            Centro Estético
            <small>Dra. Cristabel Hernández</small>
          </span>
        </div>
        <h1>Mi Cuenta</h1>
        <p className="muted">
          Entra con tu correo para ver, reprogramar o cancelar tus citas. Sin
          contraseñas: te enviamos un código de 6 dígitos.
        </p>

        {step === "email" && (
          <form onSubmit={(e) => void sendCode(e)}>
            <label>
              Correo electrónico
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn primary block" disabled={busy}>
              {busy ? "Enviando…" : "Enviarme el código"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={(e) => void verify(e)}>
            <p className="muted">
              Te enviamos un código a <strong>{email}</strong>. Escríbelo aquí,
              o entra con el enlace del mismo correo. Revisa también tu carpeta
              de spam.
            </p>
            <label>
              Código de acceso
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={10}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button
              type="submit"
              className="btn primary block"
              disabled={busy || code.length < 6}
            >
              {busy ? "Verificando…" : "Entrar"}
            </button>
            <button
              type="button"
              className="btn link"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              Usar otro correo o pedir un código nuevo
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
