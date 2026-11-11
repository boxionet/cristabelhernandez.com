import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { displayName } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setAgendaDate } from "../store/slices/uiSlice";
import PanelAppointmentCard from "./PanelAppointmentCard";
import MonthCalendar from "../components/MonthCalendar";
import { SkeletonCards } from "../components/Skeleton";

export default function Agenda() {
  const { appointments, error, reload } = usePanelData();
  // The selected day lives in Redux so it survives navigation.
  const date = useAppSelector((s) => s.ui.agendaDate);
  const dispatch = useAppDispatch();
  const setDate = (d: string) => dispatch(setAgendaDate(d));

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments ?? []) {
      if (a.status === "cancelada" || a.status === "no_show") continue;
      map[a.date] = (map[a.date] ?? 0) + 1;
    }
    return map;
  }, [appointments]);

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <SkeletonCards count={2} />;

  const dayList = appointments.filter((a) => a.date === date);

  return (
    <>
      <h2 className="section-title">Agenda</h2>
      <div className="agenda-layout">
        <section className="card cal-card">
          <MonthCalendar value={date} onPick={setDate} counts={counts} />
        </section>

        <div className="agenda-day">
          <h3 className="day-title">{formatDateEs(date)}</h3>

          {dayList.length === 0 && (
            <section className="card empty">
              <p>No hay citas este día.</p>
              <Link className="btn primary" to="/panel/nueva-cita">
                Registrar una cita
              </Link>
            </section>
          )}

          {dayList.map((a) => (
            <PanelAppointmentCard
              key={a.id}
              appt={a}
              onChanged={() => void reload()}
            />
          ))}
        </div>
      </div>
    </>
  );
}
