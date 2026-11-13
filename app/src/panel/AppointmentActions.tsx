import { useEffect, useState } from "react";
import { FiMoreHorizontal, FiTrash2, FiXCircle } from "react-icons/fi";
import {
  clinicToday,
  confirmHold,
  displayName,
  markNoShow,
  releaseHold,
  updateAppointment,
  type PanelAppointment,
} from "../lib/panel";
import { decideAppointment } from "../lib/api";
import { formatDateEs, formatPrice, formatTime12h } from "../lib/format";
import AppointmentServicesEditor from "./AppointmentServicesEditor";
import DatePicker from "../components/DatePicker";
import { useToast } from "../components/Toast";

// Staff actions on one appointment. Direct RLS writes for the plain
// state changes (the plan's staff override: no 24h window, holds can
// be confirmed or released); the approve/reject decision goes through
// the booking-decide function so the status change and the patient
// email happen together.
// Layout (owner-approved card design, 2026-11-11, extended for the
// approval model): the everyday actions sit in the row; the
// rare/destructive ones live in the "···" overflow menu.
//   por_confirmar: Confirmar (+ Liberar in the menu)
//   pendiente:     Confirmar (+ Mover, Tratamientos; No confirmar in the menu)
//   confirmada:    Completar, Marcar pagado, Mover, Tratamientos
//                  (+ No asistió, Cancelar in the menu)
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
  const [confirmModal, setConfirmModal] = useState<"cancel" | "reject" | null>(null);
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

  const isPending = appt.status === "pendiente";
  const isConfirmed = appt.status === "confirmada";
  const active = isPending || isConfirmed;
  const showMenu =
    (appt.status === "por_confirmar" && confirming !== "release") ||
    (active && !rescheduling);

  useEffect(() => {
    if (!confirmModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setConfirmModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmModal, busy]);

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

      {isPending && !rescheduling && (
        <>
          <button type="button" className="btn primary small" disabled={busy} onClick={() => void run(async () => {
            const r = await decideAppointment(appt.id, "approve");
            toast.success(
              r.emailSent
                ? "Cita confirmada — la paciente recibió la confirmación"
                : "Cita confirmada, pero no se pudo enviar el correo de confirmación.",
            );
          })}>
            Confirmar
          </button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setRescheduling(true)}>
            Mover
          </button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setEditingServices(true)}>
            Tratamientos
          </button>
        </>
      )}

      {isConfirmed && !rescheduling && (
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
                {isPending && (
                  <button
                    type="button"
                    className="appt-menu-item danger"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmModal("reject");
                    }}
                  >
                    <FiXCircle aria-hidden /> No confirmar
                  </button>
                )}
                {isConfirmed && (
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
                        setConfirmModal("cancel");
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
          <DatePicker value={newDate} onChange={setNewDate} min={clinicToday()} />
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
    {confirmModal && (
      <div
        className="modal-backdrop"
        onClick={() => {
          if (!busy) setConfirmModal(null);
        }}
      >
        <div
          className="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label={confirmModal === "reject" ? "No confirmar cita" : "Cancelar cita"}
          onClick={(e) => e.stopPropagation()}
        >
          <h3>{confirmModal === "reject" ? "¿No confirmar esta cita?" : "¿Cancelar esta cita?"}</h3>
          <p className="modal-appt">
            <strong>{displayName(appt)}</strong> · {formatDateEs(appt.date)} ·{" "}
            {formatTime12h(appt.start_time)}
            <br />
            {appt.reference_code} · {formatPrice(appt.total_price)}
            {appt.total_is_estimate ? " (estimado)" : ""}
          </p>
          <p className="muted">
            {confirmModal === "reject"
              ? "La cita se marcará como cancelada, el horario quedará libre y la paciente recibirá un correo avisándole que su solicitud no fue confirmada."
              : "La cita se marcará como cancelada y el horario quedará libre."}
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => setConfirmModal(null)}
            >
              Volver
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (confirmModal === "reject") {
                    const r = await decideAppointment(appt.id, "reject");
                    setConfirmModal(null);
                    toast.success(
                      r.emailSent
                        ? "Cita no confirmada — la paciente recibió el aviso"
                        : "Cita no confirmada, pero no se pudo enviar el correo de aviso.",
                    );
                  } else {
                    await updateAppointment(appt.id, { status: "cancelada" });
                    setConfirmModal(null);
                  }
                }, confirmModal === "reject" ? undefined : "Cita cancelada")
              }
            >
              {confirmModal === "reject" ? "Sí, no confirmar" : "Sí, cancelar"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
