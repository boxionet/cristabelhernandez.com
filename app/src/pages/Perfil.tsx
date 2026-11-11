import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { SkeletonForm } from "../components/Skeleton";

export default function Perfil() {
  const { patient, user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setFullName(patient.fullName);
      setPhone(patient.phone ?? "");
    }
  }, [patient]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!patient) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error } = await supabase
      .from("patients")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", patient.id);
    setBusy(false);
    if (error) {
      setError("No pudimos guardar los cambios. Inténtalo de nuevo.");
      return;
    }
    setSaved(true);
  }

  if (!patient) return <SkeletonForm rows={3} />;

  return (
    <>
      <h2 className="section-title">Mi perfil</h2>
      <section className="card">
        <form onSubmit={(e) => void save(e)} className="profile-form">
          <label>
            Nombre completo
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label>
            Teléfono
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(809) 000-0000"
            />
          </label>
          <label>
            Correo electrónico
            <input value={user?.email ?? patient.email} disabled />
          </label>
          <p className="muted">
            Tu correo es tu llave de entrada: no se puede cambiar desde aquí.
            Si necesitas cambiarlo, contáctanos.
          </p>
          {error && <p className="error">{error}</p>}
          {saved && <p className="success">Cambios guardados.</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </section>
    </>
  );
}
