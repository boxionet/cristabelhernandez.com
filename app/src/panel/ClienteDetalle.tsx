import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { supabase } from "../lib/supabase";
import { isNuevo } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import PanelAppointmentCard from "./PanelAppointmentCard";
import { SkeletonCards } from "../components/Skeleton";

export default function ClienteDetalle() {
  const { id } = useParams();
  const { appointments, patients, error, reload } = usePanelData();
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const patient = patients?.find((p) => p.id === id);

  useEffect(() => {
    if (patient) setNotes(patient.notes ?? "");
  }, [patient]);

  if (error) return <p className="error">{error}</p>;
  if (!patients || !appointments) return <SkeletonCards count={2} />;
  if (!patient) {
    return (
      <section className="card empty">
        <p>No encontramos este cliente.</p>
        <Link className="btn ghost" to="/panel/clientes">
          Volver a clientes
        </Link>
      </section>
    );
  }

  const own = appointments.filter((a) => a.patient_id === patient.id);
  const spent = own
    .filter((a) => a.status === "completada")
    .reduce((s, a) => s + a.total_price, 0);

  async function saveNotes() {
    await supabase
      .from("patients")
      .update({ notes: notes.trim() || null })
      .eq("id", patient!.id);
    setSaved(true);
    void reload();
  }

  return (
    <>
      <p>
        <Link to="/panel/clientes">← Clientes</Link>
      </p>
      <section className="card">
        <div className="client-card-head">
          <h2 className="profile-name">{patient.full_name}</h2>
          <span className={`chip${isNuevo(patient.id, appointments) ? " nuevo" : ""}`}>
            {isNuevo(patient.id, appointments) ? "Nuevo" : "Recurrente"}
          </span>
        </div>
        <p className="muted">
          {patient.email}
          {patient.phone ? ` · ${patient.phone}` : ""}
        </p>
        <p className="muted">
          Cliente desde {patient.created_at.slice(0, 10)} · {own.length} citas ·{" "}
          {formatPrice(spent)} en tratamientos completados
          {patient.no_show_count > 0
            ? ` · No asistió ${patient.no_show_count} vez/veces`
            : ""}
        </p>
        <label className="notes-label">
          Notas internas
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
            rows={3}
            placeholder="Alergias, preferencias, observaciones…"
          />
        </label>
        <div className="appt-actions">
          <button type="button" className="btn primary small" onClick={() => void saveNotes()}>
            Guardar notas
          </button>
          {saved && <span className="success">Guardado.</span>}
          <Link className="btn ghost small" to={`/panel/nueva-cita?paciente=${patient.id}`}>
            Nueva cita para este cliente
          </Link>
        </div>
      </section>

      <h2 className="section-title">Historial de citas</h2>
      {own.length === 0 && (
        <section className="card empty">
          <p>Este cliente aún no tiene citas.</p>
        </section>
      )}
      {own
        .slice()
        .reverse()
        .map((a) => (
          <PanelAppointmentCard
            key={a.id}
            appt={a}
            onChanged={() => void reload()}
            showPatientName={false}
          />
        ))}
    </>
  );
}
