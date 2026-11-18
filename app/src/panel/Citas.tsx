import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FiPhone, FiPlus } from "react-icons/fi";
import {
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { displayContact, displayName } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setCitasQuery, setCitasStatus } from "../store/slices/uiSlice";
import PanelAppointmentCard from "./PanelAppointmentCard";
import { SkeletonCards } from "../components/Skeleton";

const STATUS_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "por_confirmar", label: "Esperando verificación" },
  { key: "pendiente", label: "Pendientes" },
  { key: "confirmada", label: "Confirmadas" },
];
// Finished citas (completada, cancelada, no_show) live in Historial
// now — Citas is the working view: only what still needs something.
const ACTIVE_CITAS_STATUSES = STATUS_FILTERS.map((f) => f.key);

export default function Citas() {
  const { appointments, error, reload } = usePanelData();
  // Filters live in Redux so they survive navigation. A stored value
  // from before the Historial split (e.g. "cancelada") falls back to
  // "todas" instead of an empty page.
  const storedStatus = useAppSelector((s) => s.ui.citasStatus);
  const status = ACTIVE_CITAS_STATUSES.includes(storedStatus)
    ? storedStatus
    : "todas";
  const query = useAppSelector((s) => s.ui.citasQuery);
  const dispatch = useAppDispatch();
  const setStatus = (v: string) => dispatch(setCitasStatus(v));
  const setQuery = (v: string) => dispatch(setCitasQuery(v));

  const filtered = useMemo(() => {
    if (!appointments) return [];
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      // Finished citas live in Historial — "Todas" here means all
      // ACTIVE citas, even before the chip narrows it further.
      if (!ACTIVE_CITAS_STATUSES.includes(a.status)) return false;
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
  }, [appointments, status, query]);

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <SkeletonCards count={3} />;

  return (
    <>
      <div className="citas-head">
        <h2 className="section-title">Citas</h2>
        <Link className="btn primary" to="/panel/nueva-cita">
          <FiPlus aria-hidden /> Nueva cita
        </Link>
      </div>

      <section className="card manual-card">
        <div className="manual-card-text">
          <h3>
            <span className="manual-icon">
              <FiPhone aria-hidden />
            </span>
            Citas por teléfono o WhatsApp
          </h3>
          <p>Registra aquí las citas que llegan por teléfono o WhatsApp.</p>
        </div>
        <Link className="btn manual-card-btn" to="/panel/nueva-cita">
          Registrar cita
        </Link>
      </section>

      <div className="filter-row">
        <input
          type="search"
          placeholder="Buscar por paciente, teléfono, correo o referencia…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
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
            {f.key !== "todas" &&
              ` (${appointments.filter((a) => a.status === f.key).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <section className="card empty">
          <p>No hay citas con ese filtro.</p>
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
            />
          ))}
        </div>
      )}
    </>
  );
}
