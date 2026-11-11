import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { clinicToday, displayName, usePanelData } from "../lib/panel";
import AppointmentActions from "./AppointmentActions";
import MonthCalendar from "../components/MonthCalendar";
import { SkeletonCards } from "../components/Skeleton";

export default function Agenda() {
  const { appointments, error, reload } = usePanelData();
  const [date, setDate] = useState(clinicToday());

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
            <article key={a.id} className="card appt">
              <div className="appt-head">
                <div>
                  <h3 className="appt-date">
                    {formatTime12h(a.start_time)} · {displayName(a)}
                  </h3>
                  <p className="appt-ref">
                    {a.reference_code} · {a.source}
                    {a.internal_notes ? ` · Nota: ${a.internal_notes}` : ""}
                  </p>
                </div>
                <span className={`pill status-${a.status}`}>
                  {STATUS_LABELS[a.status]}
                </span>
              </div>
              <ul className="appt-items">
                {a.appointment_services.map((i) => (
                  <li key={i.id}>
                    <span>
                      {i.service_name}
                      {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                    </span>
                    <span>{formatPrice(i.unit_price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="appt-foot">
                <span className="appt-total">
                  {a.total_is_estimate ? "Total estimado: " : "Total: "}
                  <strong>{formatPrice(a.total_price)}</strong>
                </span>
                {a.payment_status === "pagado" ? (
                  <span className="muted">Pagado</span>
                ) : (
                  <span className="pill pill-pay">Pago pendiente</span>
                )}
              </div>
              <AppointmentActions appt={a} onChanged={() => void reload()} />
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
