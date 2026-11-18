import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonCards } from "../components/Skeleton";
import PanelAppointmentCard from "./PanelAppointmentCard";

/**
 * The Dra's action queue: everything awaiting something, in two
 * labeled groups. "Esperando tu confirmación" holds verified citas
 * awaiting HER decision (pendiente), soonest appointment first — her
 * action items. "Esperando al paciente" holds citas whose email link
 * the patient hasn't clicked yet (por_confirmar), soonest expiry
 * first, so a hold about to expire surfaces at the top; the Dra can
 * confirm one herself from its card instead of waiting for the click.
 * Each card carries the same actions as in Citas — this view is only
 * the focused list.
 */
export default function PorConfirmar() {
  const { appointments, error, reload } = usePanelData();

  const { waitingDra, waitingPatient } = useMemo(() => {
    const all = appointments ?? [];
    const byAppointment = (a: (typeof all)[number], b: (typeof all)[number]) =>
      `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`);
    const waitingDra = all
      .filter((a) => a.status === "pendiente")
      .sort(byAppointment);
    // Soonest expiring hold first; holds without an expiry (the
    // confirmation email failed to send) sort last.
    const waitingPatient = all
      .filter((a) => a.status === "por_confirmar")
      .sort(
        (a, b) =>
          (a.confirmation_expires_at ?? "9999").localeCompare(
            b.confirmation_expires_at ?? "9999",
          ) || byAppointment(a, b),
      );
    return { waitingDra, waitingPatient };
  }, [appointments]);

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <SkeletonCards count={3} />;

  const empty = waitingDra.length === 0 && waitingPatient.length === 0;

  return (
    <>
      <h2 className="section-title">Por confirmar</h2>

      {empty && (
        <section className="card empty">
          <p>No hay citas pendientes de confirmación.</p>
          <Link className="btn primary" to="/panel/citas">
            Ver todas las citas
          </Link>
        </section>
      )}

      {waitingDra.length > 0 && (
        <>
          <h3 className="queue-group-title">
            Esperando tu confirmación ({waitingDra.length})
          </h3>
          <div className="appt-list">
            {waitingDra.map((a) => (
              <PanelAppointmentCard
                key={a.id}
                appt={a}
                onChanged={() => void reload()}
                showContact
              />
            ))}
          </div>
        </>
      )}

      {waitingPatient.length > 0 && (
        <>
          <h3 className="queue-group-title">
            Esperando al paciente ({waitingPatient.length})
          </h3>
          <div className="appt-list">
            {waitingPatient.map((a) => (
              <PanelAppointmentCard
                key={a.id}
                appt={a}
                onChanged={() => void reload()}
                showContact
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
