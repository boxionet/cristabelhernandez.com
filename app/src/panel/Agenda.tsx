import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { clinicToday, displayName, usePanelData } from "../lib/panel";
import AppointmentActions from "./AppointmentActions";
import { SkeletonCards } from "../components/Skeleton";

const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The 42 ISO dates (6 Monday-first weeks) covering the given month. */
function monthCells(monthKey: string): string[] {
  const first = new Date(`${monthKey}-01T12:00:00Z`);
  const dow = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = shiftDate(`${monthKey}-01`, -dow);
  return Array.from({ length: 42 }, (_, i) => shiftDate(start, i));
}

function monthTitle(monthKey: string): string {
  const d = new Date(`${monthKey}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function Agenda() {
  const { appointments, error, reload } = usePanelData();
  const today = clinicToday();
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));

  const cells = useMemo(() => monthCells(month), [month]);

  if (error) return <p className="error">{error}</p>;
  if (!appointments) return <SkeletonCards count={2} />;

  const countFor = (d: string) =>
    appointments.filter(
      (a) => a.date === d && a.status !== "cancelada" && a.status !== "no_show",
    ).length;
  const dayList = appointments.filter((a) => a.date === date);

  const pick = (d: string) => {
    setDate(d);
    if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7));
  };

  return (
    <>
      <h2 className="section-title">Agenda</h2>
      <div className="agenda-layout">
        <section className="card cal-card">
          <div className="cal-head">
            <h3 className="cal-title">{monthTitle(month)}</h3>
            <div className="cal-nav">
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  setDate(today);
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className="cal-arrow"
                aria-label="Mes anterior"
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                className="cal-arrow"
                aria-label="Mes siguiente"
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
          <div className="cal-grid">
            {DOW.map((d) => (
              <span key={d} className="cal-dow">
                {d}
              </span>
            ))}
            {cells.map((d) => {
              const n = countFor(d);
              const inMonth = d.slice(0, 7) === month;
              return (
                <button
                  key={d}
                  type="button"
                  className={`cal-day${inMonth ? "" : " dim"}`}
                  onClick={() => pick(d)}
                >
                  <span
                    className={`cal-num${d === date ? " selected" : ""}${d === today ? " today" : ""}`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className={`cal-count${n === 0 ? " none" : ""}`}>
                    {n > 0 ? `${n} cita${n > 1 ? "s" : ""}` : "·"}
                  </span>
                </button>
              );
            })}
          </div>
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
