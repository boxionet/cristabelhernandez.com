import { useState } from "react";
import { useAuth } from "../auth";
import { cancelAppointment, errorText } from "../lib/api";
import {
  canSelfManage,
  formatDateEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import type { Appointment } from "../lib/types";
import ReschedulePanel from "./ReschedulePanel";

export default function AppointmentCard({
  appointment,
  onChanged,
  readOnly = false,
}: {
  appointment: Appointment;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const { session } = useAuth();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manageable = !readOnly && canSelfManage(appointment);
  const active =
    appointment.status === "pendiente" || appointment.status === "confirmada";
  const insideWindow = !readOnly && active && !manageable;

  async function doCancel() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await cancelAppointment(session.access_token, appointment.id);
      onChanged?.();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      setConfirmingCancel(false);
    }
  }

  return (
    <article className="card appt">
      <div className="appt-head">
        <div>
          <h3 className="appt-date">
            {formatDateEs(appointment.date)} · {formatTime12h(appointment.start_time)}
          </h3>
          <p className="appt-ref">Referencia {appointment.reference_code}</p>
        </div>
        <span className={`pill status-${appointment.status}`}>
          {STATUS_LABELS[appointment.status]}
        </span>
      </div>

      <ul className="appt-items">
        {appointment.appointment_services.map((item) => (
          <li key={item.id}>
            <span>
              {item.service_name}
              {item.quantity > 1 ? ` × ${item.quantity}` : ""}
            </span>
            <span>
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

      <div className="appt-foot">
        <span className="appt-total">
          {appointment.total_is_estimate ? "Total estimado: " : "Total: "}
          <strong>{formatPrice(appointment.total_price)}</strong>
        </span>
        {active && appointment.payment_status === "pendiente" && (
          <span className="muted">A pagar en el centro (efectivo)</span>
        )}
        {appointment.payment_status === "pagado" && (
          <span className="paid">Pagado en el centro</span>
        )}
      </div>

      {insideWindow && (
        <p className="note">
          Falta menos de 24 horas para tu cita: para cambiarla o cancelarla,
          llámanos o responde al correo de tu cita.
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {manageable && !rescheduling && !confirmingCancel && (
        <div className="appt-actions">
          <button type="button" className="btn ghost" onClick={() => setRescheduling(true)}>
            Reprogramar
          </button>
          <button
            type="button"
            className="btn danger-ghost"
            onClick={() => setConfirmingCancel(true)}
          >
            Cancelar cita
          </button>
        </div>
      )}

      {manageable && confirmingCancel && (
        <div className="appt-actions confirm-row">
          <span>¿Segura que quieres cancelar esta cita?</span>
          <button type="button" className="btn ghost" onClick={() => setConfirmingCancel(false)} disabled={busy}>
            Volver
          </button>
          <button type="button" className="btn danger" onClick={() => void doCancel()} disabled={busy}>
            {busy ? "Cancelando…" : "Sí, cancelar"}
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
    </article>
  );
}
