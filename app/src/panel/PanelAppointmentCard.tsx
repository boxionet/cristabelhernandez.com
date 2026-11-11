import { Link } from "react-router-dom";
import { FiEdit3 } from "react-icons/fi";
import {
  formatDateLongEs,
  formatPrice,
  formatTime12h,
  STATUS_LABELS,
} from "../lib/format";
import { displayContact, displayName, type PanelAppointment } from "../lib/panel";
import AppointmentActions from "./AppointmentActions";

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

/**
 * The Panel appointment card — one shared design (owner-approved
 * 2026-11-11) for Citas, the Agenda day list and each client's
 * Historial de citas, so the three can never drift apart again.
 * Zones: who & when (date chip + headline) / services / money / note /
 * actions. With showPatientName off (Historial), the headline is the
 * date instead of the patient.
 */
export default function PanelAppointmentCard({
  appt,
  onChanged,
  showPatientName = true,
  showContact = false,
}: {
  appt: PanelAppointment;
  onChanged: () => void;
  showPatientName?: boolean;
  showContact?: boolean;
}) {
  const p = dateParts(appt.date);
  const vence =
    appt.status === "por_confirmar" && appt.confirmation_expires_at
      ? ` · Vence ${new Date(appt.confirmation_expires_at).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" })}`
      : "";

  return (
    <article className="card appt2">
      <div className="appt2-head">
        <div className="datechip" aria-hidden>
          <span className="dc-dow">{p.dow}</span>
          <span className="dc-day">{p.day}</span>
          <span className="dc-mon">{p.mon}</span>
        </div>
        <div className="appt2-who">
          {showPatientName ? (
            <div className="appt2-name">
              {appt.patient_id ? (
                <Link to={`/panel/clientes/${appt.patient_id}`}>
                  {displayName(appt)}
                </Link>
              ) : (
                <strong>{displayName(appt)}</strong>
              )}
            </div>
          ) : (
            <div className="appt2-name appt2-date">
              {formatDateLongEs(appt.date)}
            </div>
          )}
          <p className="appt2-when">
            {formatTime12h(appt.start_time)} · {appt.duration_minutes} min ·{" "}
            {appt.reference_code} · {appt.source}
            {vence}
          </p>
          {showContact && (
            <p className="appt2-contact">{displayContact(appt)}</p>
          )}
        </div>
        <span className={`pill status-${appt.status}`}>
          {STATUS_LABELS[appt.status]}
        </span>
      </div>

      <ul className="appt2-items">
        {appt.appointment_services.map((i) => (
          <li key={i.id}>
            <span>
              {i.service_name}
              {i.quantity > 1 ? ` × ${i.quantity}` : ""}
            </span>
            <span className="appt2-price">
              {formatPrice(i.unit_price * i.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="appt2-money">
        <span className="appt2-total-label">
          {appt.total_is_estimate ? "Total estimado" : "Total"}
        </span>
        <span className="appt2-money-right">
          {appt.payment_status === "pagado" ? (
            <span className="appt2-paid">Pagado</span>
          ) : (
            <span className="pill pill-pay">Pago pendiente</span>
          )}
          <strong className="appt2-amount">
            {formatPrice(appt.total_price)}
          </strong>
        </span>
      </div>

      {appt.internal_notes && (
        <p className="appt2-note">
          <FiEdit3 aria-hidden />
          <span>
            <strong>Nota interna:</strong> {appt.internal_notes}
          </span>
        </p>
      )}

      <AppointmentActions appt={appt} onChanged={onChanged} />
    </article>
  );
}
