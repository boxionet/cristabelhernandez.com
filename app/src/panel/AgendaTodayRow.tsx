import { Link } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import {
  clinicTodayISO,
  formatDateTimeShortEs,
  formatPrice,
  formatTime12h,
  formatTimeShortEs,
  STATUS_LABELS,
  toClinicDateISO,
} from "../lib/format";
import {
  displayName,
  servicesSummary,
  type PanelAppointment,
} from "../lib/panel";

/** "09:00:00" + 45 min -> "09:45:00" (same-day arithmetic; clinic closes 18:00). */
function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * One compact "Agenda de hoy" row: time range, status bar, patient +
 * services on one line, status pill + amount, chevron. The full card
 * (services with prices, note, actions) stays in Citas and Agenda —
 * the dashboard row links there. The verification-link expiry keeps
 * its own amber line, only on unverified holds, so it can never be
 * confused with the appointment time.
 */
export default function AgendaTodayRow({ appt }: { appt: PanelAppointment }) {
  const venceAt =
    appt.status === "por_confirmar" ? appt.confirmation_expires_at : null;
  const venceLabel = venceAt
    ? toClinicDateISO(venceAt) === clinicTodayISO()
      ? `El enlace vence hoy ${formatTimeShortEs(venceAt)}`
      : `El enlace vence el ${formatDateTimeShortEs(venceAt)}`
    : null;

  return (
    <li>
      <Link to="/panel/citas" className="agenda-row">
        <div className="agenda-time">
          <div className="start">{formatTime12h(appt.start_time)}</div>
          <div className="end">
            {formatTime12h(endTime(appt.start_time, appt.duration_minutes))}
          </div>
        </div>
        <div className={`agenda-bar ${appt.status}`} aria-hidden />
        <div className="agenda-main">
          <div className="agenda-name">
            {displayName(appt)}
            <span className="ref">{appt.reference_code}</span>
          </div>
          <div className="agenda-services">
            {servicesSummary(appt)}
            {venceLabel && (
              <span className="vence"> · {venceLabel}</span>
            )}
          </div>
        </div>
        <div className="agenda-right">
          <span className="agenda-amount">
            {formatPrice(appt.total_price)}
          </span>
          <span className={`pill status-${appt.status}`}>
            {STATUS_LABELS[appt.status]}
          </span>
        </div>
        <FiChevronRight className="agenda-chevron" aria-hidden />
      </Link>
    </li>
  );
}
