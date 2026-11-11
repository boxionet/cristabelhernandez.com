import { useEffect, useState } from "react";
import { FiMoreHorizontal, FiTrash2, FiXCircle } from "react-icons/fi";
import {
  confirmHold,
  displayName,
  markNoShow,
  releaseHold,
  updateAppointment,
  type PanelAppointment,
} from "../lib/panel";
import { formatDateEs, formatPrice, formatTime12h } from "../lib/format";
import AppointmentServicesEditor from "./AppointmentServicesEditor";
import { useToast } from "../components/Toast";

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
  const [cancelModal, setCancelModal] = useState(false);
  const [newDate, setNewDate] = useState(appt.date);
  const [newTime, setNewTime] = useState(appt.start_time.slice(0, 5));
  const toast = useToast();

  async function run(fn: () => Promise<void>, successMessage?: string) {
    setBusy(true);
    setMenuOpen(false);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      onChanged();
    } catch {
      toast.error("No se pudo guardar el cambio. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  async function saveReschedule() {
    setBusy(true);
    try {
      await updateAppointment(appt.id, { date: newDate, start_time: newTime });
      setRescheduling(false);
      toast.success("Cita movida");
      onChanged();
    } catch {
      toast.error(
        "No se pudo mover la cita (puede chocar con otra). Revisa el horario.",
      );
      setBusy(false);
    }
  }

  const active = appt.status === "pendiente" || appt.status === "confirmada";
  const showMenu =
    (appt.status === "por_confirmar" && confirming !== "release") ||
    (active && !rescheduling);

  useEffect(() => {
    if (!cancelModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setCancelModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelModal, busy]);

  return (
    <>
    <div className="appt-actions staff">
      {appt.status === "por_confirmar" && confirming !== "release" && (
        <button type="button" className="btn primary small" disabled={busy} onClick={() => void run(() => confirmHold(appt), "Cita confirmada")}>
          Confirmar
        </button>
      )}
      {appt.status === "por_confirmar" && confirming === "release" && (
        <>
          <span>¿Liberar este apartado?</span>
          <button type="button" className="btn ghost small" onClick={() => setConfirming(null)} disabled={busy}>
            Volver
          </button>
          <button type="button" className="btn danger small" disabled={busy} onClick={() => void run(() => releaseHold(appt.id), "Apartado liberado")}>
            Sí, liberar
          </button>
        </>
      )}

      {active && !rescheduling && (
        <>
          <button type="button" className="btn primary small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { status: "completada" }), "Cita completada")}>
            Completar
          </button>
          {appt.payment_status === "pendiente" && (
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { payment_status: "pagado" }), "Pago registrado")}>
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
      {appt.status === "completada" && appt.payment_status === "pendiente" && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => void run(() => updateAppointment(appt.id, { payment_status: "pagado" }), "Pago registrado")}>
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
                      onClick={() => void run(() => markNoShow(appt), "Marcada como no asistió")}
                    >
                      <FiXCircle aria-hidden /> No asistió
                    </button>
                    <button
                      type="button"
                      className="appt-menu-item danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setCancelModal(true);
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
            <strong>{displayName(appt)}</strong> · {formatDateEs(appt.date)} ·{" "}
            {formatTime12h(appt.start_time)}
            <br />
            {appt.reference_code} · {formatPrice(appt.total_price)}
            {appt.total_is_estimate ? " (estimado)" : ""}
          </p>
          <p className="muted">
            La cita se marcará como cancelada y el horario quedará libre.
          </p>
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
              onClick={() =>
                void run(async () => {
                  await updateAppointment(appt.id, { status: "cancelada" });
                  setCancelModal(false);
                }, "Cita cancelada")
              }
            >
              Sí, cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
