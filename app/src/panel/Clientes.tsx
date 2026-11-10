import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { isNuevo, usePanelData } from "../lib/panel";

export default function Clientes() {
  const { appointments, patients, error } = usePanelData();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (!patients || !appointments) return [];
    const q = query.trim().toLowerCase();
    return patients
      .filter(
        (p) =>
          !q ||
          [p.full_name, p.email, p.phone ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
      )
      .map((p) => {
        const own = appointments.filter(
          (a) => a.patient_id === p.id && a.status !== "cancelada",
        );
        const spent = own
          .filter((a) => a.status === "completada")
          .reduce((s, a) => s + a.total_price, 0);
        const last = own.length ? own[own.length - 1].date : null;
        return { p, count: own.length, spent, last };
      });
  }, [patients, appointments, query]);

  if (error) return <p className="error">{error}</p>;
  if (!patients || !appointments) return <p className="muted">Cargando clientes…</p>;

  return (
    <>
      <h2 className="section-title">Clientes</h2>
      <div className="filter-row">
        <input
          type="search"
          placeholder="Buscar por nombre, correo o teléfono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
      </div>
      {rows.length === 0 && (
        <section className="card empty">
          <p>No hay clientes con esa búsqueda.</p>
        </section>
      )}
      <section className="treat-grid">
        {rows.map(({ p, count, spent, last }) => (
          <Link key={p.id} to={`/panel/clientes/${p.id}`} className="card treat client-card">
            <div className="client-card-head">
              <h3>{p.full_name}</h3>
              <span className={`chip${isNuevo(p.id, appointments) ? " nuevo" : ""}`}>
                {isNuevo(p.id, appointments) ? "Nuevo" : "Recurrente"}
              </span>
            </div>
            <p className="muted">{p.email}</p>
            {p.phone && <p className="muted">{p.phone}</p>}
            <p className="muted">
              {count} {count === 1 ? "cita" : "citas"}
              {last ? ` · Última: ${last}` : ""}
            </p>
            <p className="treat-spent">{formatPrice(spent)}</p>
            {p.no_show_count > 0 && (
              <p className="error">No asistió {p.no_show_count} vez/veces</p>
            )}
          </Link>
        ))}
      </section>
    </>
  );
}
