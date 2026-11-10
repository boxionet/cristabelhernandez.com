import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { errorText, fetchSlots, rescheduleAppointment } from "../lib/api";
import { formatTime12h } from "../lib/format";
import type { Appointment } from "../lib/types";

function todayISO(): string {
  // Clinic "today" (America/Santo_Domingo) as YYYY-MM-DD.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function ReschedulePanel({
  appointment,
  onDone,
  onClose,
}: {
  appointment: Appointment;
  onDone: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [date, setDate] = useState(appointment.date);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setPicked(null);
    fetchSlots(date, appointment.duration_minutes).then((res) => {
      if (cancelled) return;
      if (res) {
        setOpen(res.open);
        // The appointment's own current slot counts as available to itself.
        const list = [...res.slots];
        if (date === appointment.date) {
          const own = appointment.start_time.slice(0, 5);
          if (!list.includes(own)) {
            list.push(own);
            list.sort();
          }
        }
        setSlots(list);
      } else {
        setSlots([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, appointment]);

  async function confirm() {
    if (!picked || !session) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleAppointment(session.access_token, appointment.id, date, picked);
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="reschedule">
      <div className="reschedule-row">
        <label>
          Nueva fecha
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {slots === null && <p className="muted">Buscando horarios…</p>}
      {slots !== null && !open && (
        <p className="muted">El centro está cerrado ese día. Elige otra fecha.</p>
      )}
      {slots !== null && open && slots.length === 0 && (
        <p className="muted">No quedan horarios ese día para esta cita. Elige otra fecha.</p>
      )}
      {slots !== null && slots.length > 0 && (
        <div className="slot-grid">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              className={`slot${picked === s ? " picked" : ""}`}
              onClick={() => setPicked(s)}
            >
              {formatTime12h(s)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="reschedule-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
          Volver
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => void confirm()}
          disabled={!picked || busy}
        >
          {busy ? "Guardando…" : "Confirmar cambio"}
        </button>
      </div>
    </div>
  );
}
