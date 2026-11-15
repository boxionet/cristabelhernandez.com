import { FiActivity, FiCalendar, FiCheckCircle } from "react-icons/fi";
import AppointmentCard from "../components/AppointmentCard";
import { clinicTodayISO, isUpcoming } from "../lib/format";
import { useAppointments } from "../lib/queries/patientQueries";
import { SkeletonCards, SkeletonKpis } from "../components/Skeleton";

export default function MisCitas() {
  const { rows, error, reload } = useAppointments();

  if (error) return <p className="error">{error}</p>;
  if (!rows)
    return (
      <>
        <SkeletonKpis count={3} />
        <SkeletonCards count={2} />
      </>
    );

  const upcoming = rows.filter(isUpcoming);
  const completed = rows.filter((r) => r.status === "completada");
  // Progress, not money: the patient sees how much care she has kept
  // up this year — never an accumulated total spent.
  const thisYear = clinicTodayISO().slice(0, 4);
  const sessionsThisYear = completed.filter((r) =>
    r.date.startsWith(thisYear),
  ).length;
  const next = upcoming[0];
  const rest = next ? upcoming.slice(1) : upcoming;

  return (
    <>
      <section className="kpis">
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiCalendar aria-hidden />
          </span>
          <span>
            <span className="kpi-value">{upcoming.length}</span>
            <span className="kpi-label">Citas próximas</span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiCheckCircle aria-hidden />
          </span>
          <span>
            <span className="kpi-value">{completed.length}</span>
            <span className="kpi-label">Citas completadas</span>
          </span>
        </div>
        <div className="card kpi kpi-flex">
          <span className="kpi-ic">
            <FiActivity aria-hidden />
          </span>
          <span>
            <span className="kpi-value">{sessionsThisYear}</span>
            <span className="kpi-label">Sesiones este año</span>
          </span>
        </div>
      </section>

      {next && (
        <>
          <h2 className="section-title">Tu próxima cita</h2>
          <AppointmentCard
            appointment={next}
            onChanged={() => void reload()}
            showCountdown
          />
        </>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="section-title">
            {next ? "También tienes" : "Tus citas próximas"}
          </h2>
          {rest.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onChanged={() => void reload()}
            />
          ))}
        </>
      )}

      {upcoming.length === 0 && (
        <section className="card empty">
          <p>Aún no tienes citas próximas.</p>
          <a className="btn primary" href="/reservar/">
            Reservar una cita
          </a>
        </section>
      )}

      {next && rest.length === 0 && (
        <div className="reserve-cta">
          <p>
            <strong>¿Necesitas otro tratamiento?</strong>
            <span>Reserva tu próxima cita en menos de un minuto.</span>
          </p>
          <a className="btn primary" href="/reservar/">
            Reservar una cita
          </a>
        </div>
      )}
    </>
  );
}
