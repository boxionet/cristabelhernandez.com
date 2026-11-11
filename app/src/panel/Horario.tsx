import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import { supabase } from "../lib/supabase";
import { usePanelData, type ScheduleRow } from "../lib/panel";
import DatePicker from "../components/DatePicker";
import { SkeletonTable } from "../components/Skeleton";

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function ScheduleEditor({
  row,
  onSaved,
}: {
  row: ScheduleRow;
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(row.is_open);
  const [open, setOpen] = useState(row.open_time.slice(0, 5));
  const [close, setClose] = useState(row.close_time.slice(0, 5));
  const [saved, setSaved] = useState(false);

  async function save() {
    await supabase
      .from("weekly_schedule")
      .update({ is_open: isOpen, open_time: open, close_time: close })
      .eq("weekday", row.weekday);
    setSaved(true);
    onSaved();
  }

  return (
    <tr>
      <td>
        <strong>{DAY_NAMES[row.weekday]}</strong>
      </td>
      <td>
        <label className="check-label">
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => {
              setIsOpen(e.target.checked);
              setSaved(false);
            }}
          />
          Abierto
        </label>
      </td>
      <td>
        <input
          type="time"
          value={open}
          disabled={!isOpen}
          onChange={(e) => {
            setOpen(e.target.value);
            setSaved(false);
          }}
        />
      </td>
      <td>
        <input
          type="time"
          value={close}
          disabled={!isOpen}
          onChange={(e) => {
            setClose(e.target.value);
            setSaved(false);
          }}
        />
      </td>
      <td>
        <button type="button" className="btn primary small" onClick={() => void save()}>
          Guardar
        </button>
        {saved && (
          <span className="success">
            {" "}
            <FiCheck aria-hidden />
          </span>
        )}
      </td>
    </tr>
  );
}

export default function Horario() {
  const { schedule, exceptions, error, reload } = usePanelData();
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState(true);
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("18:00");
  const [reason, setReason] = useState("");

  if (error) return <p className="error">{error}</p>;
  if (!schedule || !exceptions) return <SkeletonTable rows={7} />;

  async function addException() {
    if (!date) return;
    await supabase.from("date_exceptions").insert({
      date,
      is_closed: closed,
      open_time: closed ? null : open,
      close_time: closed ? null : close,
      reason: reason.trim() || null,
    });
    setDate("");
    setReason("");
    void reload();
  }

  async function removeException(id: string) {
    await supabase.from("date_exceptions").delete().eq("id", id);
    void reload();
  }

  return (
    <>
      <h2 className="section-title">Horario semanal</h2>
      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Día</th>
              <th>Estado</th>
              <th>Apertura</th>
              <th>Cierre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((weekday) => {
              const row = schedule.find((s) => s.weekday === weekday);
              return row ? (
                <ScheduleEditor
                  key={weekday}
                  row={row}
                  onSaved={() => void reload()}
                />
              ) : null;
            })}
          </tbody>
        </table>
        <p className="muted">
          La disponibilidad de la web se calcula con este horario: la última
          cita puede empezar hasta que quepa su duración completa antes del
          cierre.
        </p>
      </section>

      <h2 className="section-title">Días especiales (feriados, cierres, horarios cortos)</h2>
      <section className="card">
        {exceptions.length === 0 && (
          <p className="muted">No hay días especiales registrados.</p>
        )}
        <ul className="exception-list">
          {exceptions.map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.date}</strong> ·{" "}
                {e.is_closed
                  ? "Cerrado"
                  : `Abierto ${e.open_time?.slice(0, 5)}–${e.close_time?.slice(0, 5)}`}
                {e.reason ? ` · ${e.reason}` : ""}
              </span>
              <button
                type="button"
                className="btn danger-ghost small"
                onClick={() => void removeException(e.id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="form-grid">
          <label>
            Fecha
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="Elige la fecha"
            />
          </label>
          <label>
            Motivo
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Feriado, actividad, etc."
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={closed}
            onChange={(e) => setClosed(e.target.checked)}
          />
          Cerrado todo el día
        </label>
        {!closed && (
          <div className="form-grid">
            <label>
              Apertura
              <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
            </label>
            <label>
              Cierre
              <input type="time" value={close} onChange={(e) => setClose(e.target.value)} />
            </label>
          </div>
        )}
        <button type="button" className="btn primary" onClick={() => void addException()}>
          Agregar día especial
        </button>
      </section>
    </>
  );
}
