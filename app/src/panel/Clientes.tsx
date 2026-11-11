import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiChevronRight, FiMail, FiPhone, FiSearch } from "react-icons/fi";
import { formatDateLongEs, formatPrice } from "../lib/format";
import { clinicToday, isNuevo } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonCards } from "../components/Skeleton";

export default function Clientes() {
  const { appointments, patients, error } = usePanelData();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (!patients || !appointments) return [];
    const q = query.trim().toLowerCase();
    const today = clinicToday();
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
        const done = own.filter((a) => a.status === "completada").length;
        const last = own.length ? own[own.length - 1].date : null;
        const upcoming = own
          .filter((a) => a.date >= today && a.status !== "no_show")
          .map((a) => a.date)
          .sort();
        const next = upcoming.length ? upcoming[0] : null;
        return { p, count: own.length, spent, done, last, next };
      });
  }, [patients, appointments, query]);

  if (error) return <p className="error">{error}</p>;
  if (!patients || !appointments) return <SkeletonCards count={4} />;

  return (
    <>
      <h2 className="section-title">Clientes</h2>
      <div className="search-bar">
        <FiSearch aria-hidden />
        <input
          type="search"
          placeholder="Buscar por nombre, correo o teléfono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {rows.length === 0 && (
        <section className="card empty">
          <p>No hay clientes con esa búsqueda.</p>
        </section>
      )}
      <section className="clients-grid">
        {rows.map(({ p, count, spent, done, last, next }) => {
          const nuevo = isNuevo(p.id, appointments);
          return (
            <Link
              key={p.id}
              to={`/panel/clientes/${p.id}`}
              className="card client2"
            >
              <div className="client2-head">
                <span className="client2-avatar">
                  {p.full_name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="client2-id">
                  <p className="client2-name">
                    <strong>{p.full_name}</strong>
                    <span className={`chip${nuevo ? " nuevo" : " recur"}`}>
                      {nuevo ? "Nuevo" : "Recurrente"}
                    </span>
                  </p>
                  <p className="client2-contact">
                    <FiMail aria-hidden /> {p.email}
                    {p.phone && (
                      <>
                        {" · "}
                        <FiPhone aria-hidden /> {p.phone}
                      </>
                    )}
                  </p>
                </div>
                <FiChevronRight className="client2-chev" aria-hidden />
              </div>
              <div className="client2-stats">
                <span className="cstat">
                  <span className="v">{count}</span>
                  <span className="l">Citas</span>
                </span>
                <span className="cstat">
                  <span className="v">{done}</span>
                  <span className="l">Completadas</span>
                </span>
                <span className="cstat">
                  <span className="v">{formatPrice(spent)}</span>
                  <span className="l">En tratamientos</span>
                </span>
              </div>
              {p.no_show_count > 0 && (
                <p className="error client2-noshow">
                  No asistió {p.no_show_count}{" "}
                  {p.no_show_count === 1 ? "vez" : "veces"}
                </p>
              )}
              <p className="client2-foot">
                <FiCalendar aria-hidden />
                {next ? (
                  <>
                    Próxima cita: <strong>{formatDateLongEs(next)}</strong>
                  </>
                ) : last ? (
                  <>
                    Última cita: <strong>{formatDateLongEs(last)}</strong>
                  </>
                ) : (
                  "Sin citas todavía"
                )}
              </p>
            </Link>
          );
        })}
      </section>
    </>
  );
}
