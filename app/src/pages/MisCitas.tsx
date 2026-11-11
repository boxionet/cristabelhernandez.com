import AppointmentCard from "../components/AppointmentCard";
import { formatPrice, isUpcoming } from "../lib/format";
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
  const invested = completed.reduce((sum, r) => sum + r.total_price, 0);
  const next = upcoming[0];

  return (
    <>
      <section className="kpis">
        <div className="card kpi">
          <span className="kpi-value">{upcoming.length}</span>
          <span className="kpi-label">Citas próximas</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{completed.length}</span>
          <span className="kpi-label">Citas completadas</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{formatPrice(invested)}</span>
          <span className="kpi-label">Total invertido en ti</span>
        </div>
      </section>

      {next && (
        <>
          <h2 className="section-title">Tu próxima cita</h2>
          <AppointmentCard appointment={next} onChanged={() => void reload()} />
        </>
      )}

      <h2 className="section-title">
        {next ? "También tienes" : "Tus citas próximas"}
      </h2>
      {upcoming.length === 0 && (
        <section className="card empty">
          <p>Aún no tienes citas próximas.</p>
          <a className="btn primary" href="/reservar/">
            Reservar una cita
          </a>
        </section>
      )}
      {(next ? upcoming.slice(1) : upcoming).map((appt) => (
        <AppointmentCard
          key={appt.id}
          appointment={appt}
          onChanged={() => void reload()}
        />
      ))}
    </>
  );
}
