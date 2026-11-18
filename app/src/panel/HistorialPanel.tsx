import { useMemo, useState } from "react";
import { FiCheckCircle, FiUserX, FiXCircle } from "react-icons/fi";
import { displayContact, displayName, updateAppointment, type PanelAppointment } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { useToast } from "../components/Toast";
import PanelAppointmentCard from "./PanelAppointmentCard";
import { SkeletonCards } from "../components/Skeleton";

const FINISHED_STATUSES = ["cancelada", "no_show", "completada"] as const;
type FinishedStatus = (typeof FINISHED_STATUSES)[number];
type HistorialFilter = "todas" | FinishedStatus;

const STATUS_FILTERS: { key: HistorialFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "cancelada", label: "Canceladas" },
  { key: "no_show", label: "No asistió" },
  { key: "completada", label: "Completadas" },
];

/**
 * Panel Historial: finished citas live here, out of the Citas working
 * view. One card per cita (a patient with two canceled citas shows
 * two cards), newest first; counts count citas, not patients. Nothing
 * is deleted — this is a move between views. A canceled card can be
 * restored to pendiente, back in the Por confirmar queue for the Dra
 * to decide again.
 */
export default function HistorialPanel() {
  const { appointments, error, reload } = usePanelData();
  const toast = useToast();
  const [status, setStatus] = useState<HistorialFilter>("todas");
  const [query, setQuery] = useState("");

  const finished = useMemo(() => {
    const all = appointments ?? [];
    return all
      .filter((a) => FINISHED_STATUSES.includes(a.status as FinishedStatus))
      .sort((a, b) =>
        `${b.date}T${b.start_time}`.localeCompare(`${a.date}T${a.start_time}`),
      );
  }, [appointments]);

  const counts = useMemo(() => {
    const c: Record<FinishedStatus, number> = {
      cancelada: 0,
      no_show: 0,
      completada: 0,
    };
    for (const a of finished) c[a.status as FinishedStatus] += 1;
    return c;
  }, [finished]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return finished.filter((a) => {
      if (status !== "todas" && a.status !== status) return false;
      if (!q) return true;
      const haystack = [
        displayName(a),
        displayContact(a),
        a.patients?.phone ?? "",
        a.guest_phone ?? "",
        a.reference_code,
        a.guest_email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [finished, status, query]);

  async function restore(appt: PanelAppointment) {
    try {
      const prev = (appt.internal_notes || "").trim();
      await updateAppointment(appt.id, {
        status: "pendiente",
        internal_notes: prev
          ? `${prev}\nRestaurada por el centro.`
          : "Restaurada por el centro.",
      });
      toast.success("Cita restaurada — está en Por confirmar para decidirla");
      void reload();
    } catch {
      toast.error(
        "No se pudo restaurar la cita (puede chocar con otra). Revisa el horario.",
      );
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <SkeletonCards count={3} />;

  return (
    <>
      <h2 className="section-title">Historial</h2>
      <p className="muted">Citas canceladas, no asistidas y completadas.</p>

      <section className="kpis">
        <div className="card kpi kpi-flex">
          <span className="kpi-ic tint-red">
            <FiXCircle aria-hidden />
          </span>
          <span>
            <span className="kpi-value">{counts.cancelada}</span>
            <span className="kpi-label">Canceladas</span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic tint-gray">
            <FiUserX aria-hidden />
          </span>
          <span>
            <span className="kpi-value">{counts.no_show}</span>
            <span className="kpi-label">No asistió</span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiCheckCircle aria-hidden />
          </span>
          <span>
            <span className="kpi-value">{counts.completada}</span>
            <span className="kpi-label">Completadas</span>
          </span>
        </div>
      </section>

      <div className="filter-row">
        <input
          type="search"
          placeholder="Buscar por paciente o referencia…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
          aria-label="Buscar por paciente o referencia"
        />
      </div>
      <div className="chip-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter-chip${status === f.key ? " active" : ""}`}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
            {f.key !== "todas" && ` (${counts[f.key]})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <section className="card empty">
          <p>
            {finished.length === 0
              ? "No hay citas en el historial."
              : "No hay citas con ese filtro."}
          </p>
        </section>
      )}

      {filtered.length > 0 && (
        <div className="appt-list">
          {filtered.map((a) => (
            <PanelAppointmentCard
              key={a.id}
              appt={a}
              onChanged={() => void reload()}
              showContact
              showActions={false}
              onRestore={(appt) => restore(appt)}
            />
          ))}
        </div>
      )}
    </>
  );
}
