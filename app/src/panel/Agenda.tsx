import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice, formatTime12h, STATUS_LABELS } from "../lib/format";
import { clinicToday, displayName, usePanelData } from "../lib/panel";
import AppointmentActions from "./AppointmentActions";

const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Agenda() {
  const { appointments, error, reload } = usePanelData();
  const [date, setDate] = useState(clinicToday());

  const week = useMemo(() => {
    const start = shiftDate(date, -3);
    return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  }, [date]);

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <p className="muted">Cargando la agenda…</p>;

  const dayList = appointments.filter((a) => a.date === date);
  const countFor = (d: string) =>
    appointments.filter(
      (a) => a.date === d && a.status !== "cancelada" && a.status !== "no_show",
    ).length;

  return (
    <>
      <div className="agenda-head">
        <h2 className="section-title">Agenda</h2>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="week-strip">
        {week.map((d) => {
          const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
          return (
            <button
              key={d}
              type="button"
              className={`day-chip${d === date ? " active" : ""}`}
              onClick={() => setDate(d)}
            >
              <small>{DAY_NAMES[dow]}</small>
              <strong>{d.slice(8)}</strong>
              <small>{countFor(d)} citas</small>
            </button>
          );
        })}
      </div>

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
            <span className="muted">
              {a.payment_status === "pagado" ? "Pagado" : "Pago pendiente (efectivo)"}
            </span>
          </div>
          <AppointmentActions appt={a} onChanged={() => void reload()} />
        </article>
      ))}
    </>
  );
}
