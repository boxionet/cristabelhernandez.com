import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiUserPlus,
} from "react-icons/fi";
import {
  capitalizeFirst,
  formatDateLongEs,
  formatDateShortEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import {
  clinicToday,
  displayName,
  isNuevo,
  type PanelAppointment,
} from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonCards, SkeletonKpis } from "../components/Skeleton";
import PanelAppointmentCard from "./PanelAppointmentCard";

function servicesSummary(a: PanelAppointment): string {
  return a.appointment_services.map((i) => i.service_name).join(", ");
}

const CHIP_DOW = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const CHIP_MON = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];
const DOW_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MON_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function chipParts(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    dow: CHIP_DOW[d.getUTCDay()],
    day: d.getUTCDate(),
    mon: CHIP_MON[d.getUTCMonth()],
  };
}

function shortDow(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MON_SHORT[d.getUTCMonth()]}`;
}

export default function Dashboard() {
  const { appointments, patients, error, reload } = usePanelData();

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
  const porCobrarList = appointments.filter(
    (a) =>
      a.payment_status === "pendiente" &&
      (a.status === "pendiente" ||
        a.status === "confirmada" ||
        a.status === "completada"),
  );
  const porCobrar = porCobrarList.reduce((s, a) => s + a.total_price, 0);
  const pacientesNuevos = patients.filter(
    (p) => p.created_at.slice(0, 7) === month,
  ).length;

  const nextAppt =
    real
      .filter((a) => a.date >= today)
      .sort((a, b) =>
        `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`),
      )[0] ?? null;

  const monthName = new Intl.DateTimeFormat("es", { month: "long" }).format(
    new Date(`${today}T12:00:00Z`),
  );
  const weekdayLong = new Intl.DateTimeFormat("es", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T12:00:00Z`));
  const todayLong = `${capitalizeFirst(weekdayLong)} ${formatDateLongEs(today)}`;

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

  const allAppointments = appointments;
  function firstDateOf(patientId: string): string | null {
    const dates = allAppointments
      .filter((a) => a.patient_id === patientId && a.status !== "cancelada")
      .map((a) => a.date)
      .sort();
    return dates.length ? dates[0] : null;
  }

  const nextChip = nextAppt ? chipParts(nextAppt.date) : null;
  const RING_C = 314.16;

  return (
    <>
      <section className="kpis four">
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiCalendar />
          </span>
          <span>
            <span className="kpi-value">{citasHoy.length}</span>
            <span className="kpi-label">Citas hoy</span>
            <span className="kpi-sub">
              {nextAppt ? (
                <>
                  Próxima: <strong>{shortDow(nextAppt.date)}</strong>
                </>
              ) : (
                "Sin citas próximas"
              )}
            </span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiDollarSign />
          </span>
          <span>
            <span className="kpi-value">{formatPrice(ingresosMes)}</span>
            <span className="kpi-label">Ingresos del mes</span>
            <span className="kpi-sub">Reservados en {monthName}</span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiCreditCard />
          </span>
          <span>
            <span className="kpi-value">{formatPrice(porCobrar)}</span>
            <span className="kpi-label">Efectivo por cobrar</span>
            <span className="kpi-sub">
              <strong className="amber">
                {porCobrarList.length}{" "}
                {porCobrarList.length === 1 ? "cita" : "citas"}
              </strong>{" "}
              {porCobrarList.length === 1
                ? "pendiente de pago"
                : "pendientes de pago"}
            </span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiUserPlus />
          </span>
          <span>
            <span className="kpi-value">{pacientesNuevos}</span>
            <span className="kpi-label">Pacientes nuevos</span>
            <span className="kpi-sub">Este mes</span>
          </span>
        </div>
      </section>

      <section className="dash-grid wide">
        <div className="card chart-card">
          <div className="chart-head">
            <div>
              <h3>Ingresos — últimos 30 días</h3>
              <p className="muted chart-hint">Citas reservadas por día</p>
            </div>
            <div className="chart-side">
              <span className="chart-total">{formatPrice(total30)}</span>
              <span className="chart-legend">
                <span className="dot" />
                Reservado
              </span>
            </div>
          </div>
          <svg viewBox="0 0 600 120" className="chart" preserveAspectRatio="none">
            <polygon
              points={`0,120 ${points} 600,120`}
              fill="rgba(132,149,115,.18)"
            />
            <polyline points={points} fill="none" stroke="#849573" strokeWidth="2.5" />
          </svg>
          <p className="muted chart-note">
            {noShows30} no-show en los últimos 30 días
          </p>
        </div>

        <div className="card chart-card">
          <h3>Tasa de retorno</h3>
          <div className="ring-wrap">
            <svg width="132" height="132" viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" className="ring-track" />
              <circle
                cx="60"
                cy="60"
                r="50"
                className="ring-fill"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - returnRate / 100)}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <span className="ring-num">{returnRate}%</span>
          </div>
          <p className="muted ring-sub">
            de los pacientes vuelven por otro tratamiento
          </p>
        </div>
      </section>

      <section className="dash-grid wide">
        <div className="card">
          <div className="chart-head">
            <h3>Agenda de hoy</h3>
            <span className="muted">{todayLong}</span>
          </div>
          {citasHoy.length === 0 ? (
            <>
              <p className="agenda-empty">
                <FiCalendar /> No hay citas para hoy.
              </p>
              {nextAppt && nextChip && (
                <div className="next-row">
                  <span className="datechip">
                    <span className="dc-dow">{nextChip.dow}</span>
                    <span className="dc-day">{nextChip.day}</span>
                    <span className="dc-mon">{nextChip.mon}</span>
                  </span>
                  <span className="next-main">
                    <span className="next-tag">PRÓXIMA CITA</span>
                    <span className="next-name">{displayName(nextAppt)}</span>
                    <span className="next-sub">
                      {formatTime12h(nextAppt.start_time)} ·{" "}
                      {servicesSummary(nextAppt)}
                    </span>
                  </span>
                  <span className="next-amount">
                    {formatPrice(nextAppt.total_price)}
                  </span>
                  <span className={`pill status-${nextAppt.status}`}>
                    {STATUS_LABELS[nextAppt.status]}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="appt-list">
              {citasHoy.map((a) => (
                <PanelAppointmentCard
                  key={a.id}
                  appt={a}
                  onChanged={() => void reload()}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card">
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
          <div className="recent-block">
            <h4>Clientes recientes</h4>
            {recentPatients.length === 0 && (
              <p className="muted">Aún no hay clientes registrados.</p>
            )}
            {recentPatients.map((p) => {
              const first = firstDateOf(p.id);
              return (
                <Link
                  key={p.id}
                  to={`/panel/clientes/${p.id}`}
                  className="recent-row"
                >
                  <span className="recent-avatar">
                    {p.full_name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="recent-who">
                    <strong>{p.full_name}</strong>
                    <small>
                      {first
                        ? `Primera cita: ${formatDateShortEs(first)}`
                        : "Sin citas aún"}
                    </small>
                  </span>
                  {isNuevo(p.id, appointments) && (
                    <span className="chip nuevo">Nuevo</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
