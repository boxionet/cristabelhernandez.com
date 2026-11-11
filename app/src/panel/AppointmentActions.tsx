import { useState } from "react";
import { FiMoreHorizontal, FiTrash2, FiXCircle } from "react-icons/fi";
import {
  confirmHold,
  markNoShow,
  releaseHold,
  updateAppointment,
  type PanelAppointment,
} from "../lib/panel";
import AppointmentServicesEditor from "./AppointmentServicesEditor";

// Staff actions on one appointment. All direct RLS writes — the plan's
// staff override: no 24h window, holds can be confirmed or released.
// Layout (owner-approved card design, 2026-11-11): the everyday actions
// sit in the row; the rare/destructive ones (No asistió, Cancelar,
// Liberar) live in the "···" overflow menu.
export default function AppointmentActions({
  appt,
  onChanged,
}: {
  appt: PanelAppointment;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"cancel" | "release" | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newDate, setNewDate] = useState(appt.date);
  const [newTime, setNewTime] = useState(appt.start_time.slice(0, 5));
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMenuOpen(false);
    try {
      await fn();
      onChanged();
    } catch {
      setError("No se pudo guardar el cambio.");
      setBusy(false);
    }
  }

  async function saveReschedule() {
    setBusy(true);
    setError(null);
    try {
      await updateAppointment(appt.id, { date: newDate, start_time: newTime });
      setRescheduling(false);
      onChanged();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      void code;
      setError("No se pudo mover la cita (puede chocar con otra). Revisa el horario.");
      setBusy(false);
    }
  }

  const active = appt.status === "pendiente" || appt.status === "confirmada";
  const showMenu =
    (appt.status === "por_confirmar" && confirming !== "release") ||
    (active && !rescheduling && confirming !== "cancel");

  return (
    <>
    <div className="appt-actions staff">
      {appt.status === "por_confirmar" && confirming !== "release" && (
        <button type="button" className="btn primary small" disabled={busy} onClick={() => void run(() => confirmHold(appt))}>
          Confirmar
        </button>
      )}
      {appt.status === "por_confirmar" && confirming === "release" && (
        <>
          <span>¿Liberar este apartado?</span>
          <button type="button" className="btn ghost small" onClick={() => setConfirming(null)} disabled={busy}>
            Volver
          </button>
          <button type="button" className="btn danger small" disabled={busy} onClick={() => void run(() => releaseHold(appt.id))}>
            Sí, liberar
          </button>
        </>
      )}

      {active && !rescheduling && confirming !== "cancel" && (
        <>
          <button type="button" className="btn primary small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { status: "completada" }))}>
            Completar
          </button>
          {appt.payment_status === "pendiente" && (
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { payment_status: "pagado" }))}>
              Marcar pagado
            </button>
          )}
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setRescheduling(true)}>
            Mover
          </button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditingServices(true)}>
            Tratamientos
          </button>
        </>
      )}
      {active && confirming === "cancel" && (
        <>
          <span>¿Cancelar esta cita?</span>
          <button type="button" className="btn ghost small" onClick={() => setConfirming(null)} disabled={busy}>
            Volver
          </button>
          <button type="button" className="btn danger small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { status: "cancelada" }))}>
            Sí, cancelar
          </button>
        </>
      )}
      {appt.status === "completada" && appt.payment_status === "pendiente" && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { payment_status: "pagado" }))}>
          Marcar pagado
        </button>
      )}

      {showMenu && (
        <span className="appt-menu-wrap">
          <button
            type="button"
            className="btn ghost small appt-more"
            aria-label="Más acciones"
            aria-haspopup="menu"
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <FiMoreHorizontal aria-hidden />
          </button>
          {menuOpen && (
            <>
              <span
                className="appt-menu-backdrop"
                onClick={() => setMenuOpen(false)}
              />
              <span className="appt-menu" role="menu">
                {appt.status === "por_confirmar" && (
                  <button
                    type="button"
                    className="appt-menu-item danger"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirming("release");
                    }}
                  >
                    <FiTrash2 aria-hidden /> Liberar apartado
                  </button>
                )}
                {active && (
                  <>
                    <button
                      type="button"
                      className="appt-menu-item"
                      onClick={() => void run(() => markNoShow(appt))}
                    >
                      <FiXCircle aria-hidden /> No asistió
                    </button>
                    <button
                      type="button"
                      className="appt-menu-item danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirming("cancel");
                      }}
                    >
                      <FiTrash2 aria-hidden /> Cancelar cita
                    </button>
                  </>
                )}
              </span>
            </>
          )}
        </span>
      )}

      {rescheduling && (
        <span className="inline-reschedule">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          <button type="button" className="btn primary small" disabled={busy} onClick={() => void saveReschedule()}>
            Guardar
          </button>
          <button type="button" className="btn ghost small" onClick={() => setRescheduling(false)} disabled={busy}>
            Volver
          </button>
        </span>
      )}
      {error && <span className="error">{error}</span>}
    </div>
    {editingServices && active && (
      <AppointmentServicesEditor
        appt={appt}
        onDone={() => {
          setEditingServices(false);
          onChanged();
        }}
        onCancel={() => setEditingServices(false)}
      />
    )}
    </>
  );
}
