import { Link } from "react-router-dom";
import { formatPrice, formatTime12h, STATUS_LABELS } from "../lib/format";
import {
  clinicToday,
  displayName,
  isNuevo,
  type PanelAppointment,
} from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonCards, SkeletonKpis } from "../components/Skeleton";

function servicesSummary(a: PanelAppointment): string {
  return a.appointment_services.map((i) => i.service_name).join(", ");
}

export default function Dashboard() {
  const { appointments, patients, error } = usePanelData();

  if (error) return <p className="error">{error}</p>;
  if (!appointments || !patients)
    return (
      <>
        <SkeletonKpis count={4} />
        <SkeletonCards count={2} />
      </>
    );

  const today = clinicToday();
  const month = today.slice(0, 7);
  const real = appointments.filter(
    (a) => a.status !== "cancelada" && a.status !== "no_show",
  );

  const citasHoy = appointments.filter(
    (a) => a.date === today && a.status !== "cancelada",
  );
  const ingresosMes = real
    .filter((a) => a.date.startsWith(month))
    .reduce((s, a) => s + a.total_price, 0);
  const porCobrar = appointments
    .filter(
      (a) =>
        a.payment_status === "pendiente" &&
        (a.status === "pendiente" ||
          a.status === "confirmada" ||
          a.status === "completada"),
    )
    .reduce((s, a) => s + a.total_price, 0);
  const porCobrarCount = appointments.filter(
    (a) =>
      a.payment_status === "pendiente" &&
      (a.status === "pendiente" ||
        a.status === "confirmada" ||
        a.status === "completada"),
  ).length;
  const pacientesNuevos = patients.filter((p) =>
    p.created_at.slice(0, 7) === month,
  ).length;

  // Revenue chart: booked totals per day, last 30 days.
  const days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      total: real
        .filter((a) => a.date === iso)
        .reduce((s, a) => s + a.total_price, 0),
    });
  }
  const maxDay = Math.max(...days.map((d) => d.total), 1);
  const points = days
    .map((d, i) => `${(i / 29) * 600},${110 - (d.total / maxDay) * 95}`)
    .join(" ");
  const total30 = days.reduce((s, d) => s + d.total, 0);

  // Busiest weekday (Mon..Sun).
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // index 0 = Monday
  for (const a of real) {
    const dow = new Date(`${a.date}T12:00:00Z`).getUTCDay(); // 0 Sun
    weekdayCounts[(dow + 6) % 7] += 1;
  }
  const maxWeekday = Math.max(...weekdayCounts, 1);
  const weekdayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Return rate: patients with 2+ real bookings / all patients.
  const returning = patients.filter((p) => !isNuevo(p.id, appointments)).length;
  const returnRate =
    patients.length > 0 ? Math.round((returning / patients.length) * 100) : 0;

  const recentPatients = patients.slice(0, 5);
  const noShows30 = appointments.filter(
    (a) => a.status === "no_show" && days.some((d) => d.date === a.date),
  ).length;

  return (
    <>
      <section className="kpis four">
        <div className="card kpi">
          <span className="kpi-value">{citasHoy.length}</span>
          <span className="kpi-label">Citas hoy</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{formatPrice(ingresosMes)}</span>
          <span className="kpi-label">Ingresos del mes (reservados)</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{formatPrice(porCobrar)}</span>
          <span className="kpi-label">
            Efectivo por cobrar · {porCobrarCount} citas
          </span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{pacientesNuevos}</span>
          <span className="kpi-label">Pacientes nuevos este mes</span>
        </div>
      </section>

      <section className="dash-grid">
        <div className="card chart-card">
          <div className="chart-head">
            <h3>Ingresos — últimos 30 días</h3>
            <span className="chart-total">{formatPrice(total30)}</span>
          </div>
          <svg viewBox="0 0 600 120" className="chart" preserveAspectRatio="none">
            <polygon
              points={`0,120 ${points} 600,120`}
              fill="rgba(132,149,115,.25)"
            />
            <polyline points={points} fill="none" stroke="#3e4c35" strokeWidth="2.5" />
          </svg>
          <p className="muted chart-note">
            {noShows30} no-show en 30 días · Tasa de retorno {returnRate}%
          </p>
        </div>

        <div className="card chart-card">
          <h3>Día más activo</h3>
          <div className="bars">
            {weekdayCounts.map((count, i) => (
              <div key={i} className="bar-col">
                <div
                  className={`bar${count === maxWeekday && count > 0 ? " max" : ""}`}
                  style={{ height: `${Math.max(6, (count / maxWeekday) * 90)}px` }}
                  title={`${count} citas`}
                />
                <small>{weekdayNames[i]}</small>
                <small className="bar-count">{count}</small>
              </div>
            ))}
          </div>
          <div className="gauge-row">
            <span className="muted">Tasa de retorno</span>
            <strong>{returnRate}%</strong>
          </div>
          <div className="gauge-track">
            <div className="gauge-fill" style={{ width: `${returnRate}%` }} />
          </div>
        </div>
      </section>

      <section className="dash-grid">
        <div className="card">
          <div className="chart-head">
            <h3>Agenda de hoy</h3>
            <Link to="/panel/agenda">Ver agenda</Link>
          </div>
          {citasHoy.length === 0 && (
            <p className="muted">No hay citas para hoy.</p>
          )}
          <table className="table">
            <tbody>
              {citasHoy.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{formatTime12h(a.start_time)}</td>
                  <td>
                    <strong>{displayName(a)}</strong>
                    <br />
                    <small className="muted">{servicesSummary(a)}</small>
                  </td>
                  <td>
                    <span className={`pill status-${a.status}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="nowrap">{formatPrice(a.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="chart-head">
            <h3>Clientes recientes</h3>
            <Link to="/panel/clientes">Ver clientes</Link>
          </div>
          {recentPatients.length === 0 && (
            <p className="muted">Aún no hay clientes registrados.</p>
          )}
          <ul className="client-list">
            {recentPatients.map((p) => (
              <li key={p.id}>
                <Link to={`/panel/clientes/${p.id}`} className="client-link">
                  <span>{p.full_name}</span>
                  <span
                    className={`chip${isNuevo(p.id, appointments) ? " nuevo" : ""}`}
                  >
                    {isNuevo(p.id, appointments) ? "Nuevo" : "Recurrente"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
