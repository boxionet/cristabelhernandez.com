import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { displayContact, displayName, usePanelData } from "../lib/panel";
import AppointmentActions from "./AppointmentActions";

const STATUS_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "por_confirmar", label: "Por confirmar" },
  { key: "pendiente", label: "Pendientes" },
  { key: "confirmada", label: "Confirmadas" },
  { key: "completada", label: "Completadas" },
  { key: "cancelada", label: "Canceladas" },
  { key: "no_show", label: "No asistió" },
];

export default function Citas() {
  const { appointments, error, reload } = usePanelData();
  const [status, setStatus] = useState("todas");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!appointments) return [];
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (status !== "todas" && a.status !== status) return false;
      if (!q) return true;
      const haystack = [
        displayName(a),
        displayContact(a),
        a.reference_code,
        a.guest_email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [appointments, status, query]);

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <p className="muted">Cargando las citas…</p>;

  return (
    <>
      <h2 className="section-title">Citas</h2>
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

      {filtered.map((a) => (
        <article key={a.id} className="card appt">
          <div className="appt-head">
            <div>
              <h3 className="appt-date">
                {formatDateEs(a.date)} · {formatTime12h(a.start_time)}
              </h3>
              <p className="appt-ref">
                {a.reference_code} · {a.source}
                {a.status === "por_confirmar" && a.confirmation_expires_at
                  ? ` · Vence ${new Date(a.confirmation_expires_at).toLocaleString("es-DO")}`
                  : ""}
              </p>
            </div>
            <span className={`pill status-${a.status}`}>
              {STATUS_LABELS[a.status]}
            </span>
          </div>
          <p className="appt-patient">
            {a.patient_id ? (
              <Link to={`/panel/clientes/${a.patient_id}`}>{displayName(a)}</Link>
            ) : (
              <strong>{displayName(a)}</strong>
            )}{" "}
            <span className="muted">{displayContact(a)}</span>
          </p>
          <ul className="appt-items">
            {a.appointment_services.map((i) => (
              <li key={i.id}>
                <span>
                  {i.service_name}
                  {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                </span>
                <span>{formatPrice(i.unit_price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="appt-foot">
            <span className="appt-total">
              {a.total_is_estimate ? "Total estimado: " : "Total: "}
              <strong>{formatPrice(a.total_price)}</strong>
            </span>
            <span className="muted">
              {a.payment_status === "pagado" ? "Pagado" : "Pago pendiente"}
            </span>
          </div>
          {a.internal_notes && <p className="note">Nota interna: {a.internal_notes}</p>}
          <AppointmentActions appt={a} onChanged={() => void reload()} />
        </article>
      ))}
    </>
  );
}
