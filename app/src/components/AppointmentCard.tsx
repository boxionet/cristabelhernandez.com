import { useEffect, useState } from "react";
import { FiCheckCircle, FiDollarSign, FiPhoneCall } from "react-icons/fi";
import { useAuth } from "../auth";
import { cancelAppointment, errorText } from "../lib/api";
import {
  canSelfManage,
  daysUntilClinic,
  formatDateLongEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import type { Appointment } from "../lib/types";
import ReschedulePanel from "./ReschedulePanel";

const DOW = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
const MON = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

function dateParts(iso: string): { dow: string; day: number; mon: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { dow: DOW[dow], day: d, mon: MON[m - 1] };
}

// Patient appointment card — the zoned redesign shared with the Panel
// (owner-approved 2026-11-11): date chip + Dominican long-form date,
// services, money with the cash note, and the two patient actions.
// Cancelar opens the same confirmation modal as the Panel.
export default function AppointmentCard({
  appointment,
  onChanged,
  readOnly = false,
  showCountdown = false,
}: {
  appointment: Appointment;
  onChanged?: () => void;
  readOnly?: boolean;
  showCountdown?: boolean;
}) {
  const { session } = useAuth();
  const [cancelModal, setCancelModal] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manageable = !readOnly && canSelfManage(appointment);
  const active =
    appointment.status === "pendiente" || appointment.status === "confirmada";
  const insideWindow = !readOnly && active && !manageable;

  const p = dateParts(appointment.date);
  const days = daysUntilClinic(appointment.date);
  const countdown =
    showCountdown && active && days >= 0
      ? days === 0
        ? "Hoy"
        : days === 1
          ? "Mañana"
          : `En ${days} días`
      : null;

  useEffect(() => {
    if (!cancelModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setCancelModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelModal, busy]);

  async function doCancel() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await cancelAppointment(session.access_token, appointment.id);
      setCancelModal(false);
      onChanged?.();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <article className="card pcard">
      <div className="pcard-head">
        <div className="pchip" aria-hidden>
          <span className="pc-dow">{p.dow}</span>
          <span className="pc-day">{p.day}</span>
          <span className="pc-mon">{p.mon}</span>
        </div>
        <div className="pcard-who">
          <div className="pcard-date">
            {formatDateLongEs(appointment.date)}
          </div>
          <p className="pcard-when">
            {formatTime12h(appointment.start_time)} ·{" "}
            {appointment.duration_minutes} min
          </p>
          <p className="pcard-ref">
            Referencia {appointment.reference_code}
          </p>
        </div>
        <div className="pcard-pills">
          <span className={`pill status-${appointment.status}`}>
            {STATUS_LABELS[appointment.status]}
          </span>
          {countdown && <span className="pill pill-soon">{countdown}</span>}
        </div>
      </div>

      <ul className="pcard-items">
        {appointment.appointment_services.map((item) => (
          <li key={item.id}>
            <span>
              {item.service_name}
              {item.quantity > 1 ? ` × ${item.quantity}` : ""}
            </span>
            <span className="pcard-price">
              {item.price_from ? "Desde " : ""}
              {formatPrice(item.unit_price * item.quantity)}
              {item.price_note === "c/ampolla"
                ? " c/ampolla"
                : item.price_note
                  ? ` (${item.price_note})`
                  : ""}
            </span>
          </li>
        ))}
      </ul>

      <div className="pcard-money">
        <span className="pcard-total-label">
          {appointment.total_is_estimate ? "Total estimado" : "Total"}
        </span>
        <span className="pcard-money-right">
          <strong className="pcard-amount">
            {formatPrice(appointment.total_price)}
          </strong>
          {active && appointment.payment_status === "pendiente" && (
            <span className="pcard-cash">
              <FiDollarSign aria-hidden /> A pagar en el centro (efectivo)
            </span>
          )}
          {appointment.payment_status === "pagado" && (
            <span className="pcard-paid">
              <FiCheckCircle aria-hidden /> Pagado en el centro
            </span>
          )}
        </span>
      </div>

      {insideWindow && (
        <p className="pcard-note">
          <FiPhoneCall aria-hidden />
          <span>
            Falta menos de 24 horas para tu cita: para cambiarla o cancelarla,
            llámanos o responde al correo de tu cita.
          </span>
        </p>
      )}

      {error && !cancelModal && <p className="error">{error}</p>}

      {manageable && !rescheduling && (
        <div className="pcard-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => setRescheduling(true)}
          >
            Reprogramar
          </button>
          <button
            type="button"
            className="btn danger-ghost"
            onClick={() => setCancelModal(true)}
          >
            Cancelar cita
          </button>
        </div>
      )}

      {manageable && rescheduling && (
        <ReschedulePanel
          appointment={appointment}
          onDone={() => {
            setRescheduling(false);
            onChanged?.();
          }}
          onClose={() => setRescheduling(false)}
        />
      )}

      {cancelModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setCancelModal(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Cancelar cita"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>¿Cancelar esta cita?</h3>
            <p className="modal-appt">
              <strong>{formatDateLongEs(appointment.date)}</strong> ·{" "}
              {formatTime12h(appointment.start_time)}
              <br />
              Referencia {appointment.reference_code} ·{" "}
              {formatPrice(appointment.total_price)}
              {appointment.total_is_estimate ? " (estimado)" : ""}
            </p>
            <p className="muted">
              La cita se marcará como cancelada y el horario quedará libre.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setCancelModal(false)}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={() => void doCancel()}
              >
                {busy ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
