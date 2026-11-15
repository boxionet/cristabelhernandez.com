import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonCards } from "../components/Skeleton";
import PanelAppointmentCard from "./PanelAppointmentCard";

/**
 * The Dra's action queue: every cita that already verified its email
 * and awaits her decision, soonest first. Each card carries the same
 * Confirmar / No confirmar actions as Citas, so deciding here is
 * identical to deciding there — this view is only the focused list.
 */
export default function PorConfirmar() {
  const { appointments, error, reload } = usePanelData();

  const pending = useMemo(
    () =>
      (appointments ?? [])
        .filter((a) => a.status === "pendiente")
        .sort((a, b) =>
          `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`),
        ),
    [appointments],
  );

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <SkeletonCards count={3} />;

  return (
    <>
      <h2 className="section-title">Por confirmar</h2>

      {pending.length === 0 && (
        <section className="card empty">
          <p>No hay citas pendientes de confirmación.</p>
          <Link className="btn primary" to="/panel/citas">
            Ver todas las citas
          </Link>
        </section>
      )}

      {pending.length > 0 && (
        <div className="appt-list">
          {pending.map((a) => (
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
