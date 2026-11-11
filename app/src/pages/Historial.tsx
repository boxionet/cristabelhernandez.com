import AppointmentCard from "../components/AppointmentCard";
import { isUpcoming } from "../lib/format";
import { useAppointments } from "../lib/useAppointments";
import { SkeletonCards } from "../components/Skeleton";

export default function Historial() {
  const { rows, error } = useAppointments();

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <SkeletonCards count={3} />;

  const past = rows.filter((r) => !isUpcoming(r)).slice().reverse();

  return (
    <>
      <h2 className="section-title">Historial de citas</h2>
      {past.length === 0 && (
        <section className="card empty">
          <p>Todavía no tienes citas anteriores.</p>
        </section>
      )}
      {past.map((appt) => (
        <AppointmentCard key={appt.id} appointment={appt} readOnly />
      ))}
    </>
  );
}
