import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { profileComplete } from "../lib/profile";
import { useAppDispatch } from "../store/hooks";
import { patientUpdated } from "../store/slices/authSlice";
import { SkeletonShell } from "../components/Skeleton";
import { useToast } from "../components/Toast";

// One-time step for portal-first patients: portal-link creates their
// record with an email-prefix placeholder name and no phone, so before
// they use Mi Cuenta they give their real first name, last name and
// phone. Shown only while the record is incomplete (profileComplete);
// patients who booked first already have the data and skip it.
export default function CompletarPerfil() {
  const toast = useToast();
  const { patient, signOut } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) return;
    const prefix = patient.email.split("@")[0].trim().toLowerCase();
    const hasRealName =
      !!patient.fullName &&
      patient.fullName.trim().toLowerCase() !== prefix;
    if (hasRealName) {
      const parts = patient.fullName.trim().split(/\s+/);
      setNombre(parts[0] ?? "");
      setApellido(parts.slice(1).join(" "));
    }
    setPhone(patient.phone ?? "");
  }, [patient]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!patient) return;
    const fullName = `${nombre.trim()} ${apellido.trim()}`.trim();
    if (!nombre.trim() || !apellido.trim()) {
      setError("Escribe tu nombre y tu apellido.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError(
        "Escribe un número de teléfono válido, de al menos 10 dígitos.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("patients")
      .update({ full_name: fullName, phone: phone.trim() })
      .eq("id", patient.id);
    setBusy(false);
    if (updateError) {
      setError("No pudimos guardar tu perfil. Inténtalo de nuevo.");
      return;
    }
    dispatch(patientUpdated({ ...patient, fullName, phone: phone.trim() }));
    toast.success("¡Perfil guardado!");
    navigate("/mi-cuenta", { replace: true });
  }

  if (!patient) return <SkeletonShell />;
  if (profileComplete(patient)) {
    return <Navigate to="/mi-cuenta" replace />;
  }

  return (
    <main className="login-wrap">
      <section className="card login-card">
        <div className="brand login-brand">
          <img
            className="login-logo"
            src="/assets/svgs/cristabel-hernandez-logo.svg"
            alt="Centro Estético Dra. Cristabel Hernández"
          />
        </div>
        <h1>Completa tu perfil</h1>
        <p className="muted">
          Antes de continuar, dinos quién eres. El centro usa estos datos
          para gestionar tus citas y poder contactarte.
        </p>
        <form onSubmit={(e) => void save(e)}>
          <label>
            Nombre
            <input
              type="text"
              required
              autoComplete="given-name"
              placeholder="María"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label>
            Apellido
            <input
              type="text"
              required
              autoComplete="family-name"
              placeholder="Fernández"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </label>
          <label>
            Teléfono
            <input
              type="tel"
              required
              autoComplete="tel"
              placeholder="809 555 1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? "Guardando…" : "Guardar y continuar"}
          </button>
          <button
            type="button"
            className="btn link"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
