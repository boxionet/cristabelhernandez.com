import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { type ScheduleRow, clinicToday } from "../lib/panel";
import { buildMonthGrid, formatDayList, shiftMonthKey } from "../lib/calendarGrid";
import { formatDateLongEs, formatTime12h } from "../lib/format";
import { usePanelData } from "../lib/queries/panelQueries";
import AsyncButton from "../components/AsyncButton";
import { useToast } from "../components/Toast";
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
const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function weekdayOfISO(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function ScheduleEditor({
  row,
  onSaved,
}: {
  row: ScheduleRow;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(row.is_open);
  const [open, setOpen] = useState(row.open_time.slice(0, 5));
  const [close, setClose] = useState(row.close_time.slice(0, 5));

  async function save() {
    const { error } = await supabase
      .from("weekly_schedule")
      .update({ is_open: isOpen, open_time: open, close_time: close })
      .eq("weekday", row.weekday);
    if (error) {
      toast.error(`No se pudo guardar el horario: ${error.message}`);
      return;
    }
    toast.success(`Horario de ${DAY_NAMES[row.weekday]} guardado`);
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
            onChange={(e) => setIsOpen(e.target.checked)}
          />
          Abierto
        </label>
      </td>
      <td>
        <input
          type="time"
          value={open}
          disabled={!isOpen}
          onChange={(e) => setOpen(e.target.value)}
        />
      </td>
      <td>
        <input
          type="time"
          value={close}
          disabled={!isOpen}
          onChange={(e) => setClose(e.target.value)}
        />
      </td>
      <td>
        <AsyncButton
          className="btn primary small"
          pendingText="Guardando…"
          onClick={save}
        >
          Guardar
        </AsyncButton>
      </td>
    </tr>
  );
}

export default function Horario() {
  const toast = useToast();
  const { schedule, exceptions, error, reload } = usePanelData();
  const today = clinicToday();
  const [selectedISO, setSelectedISO] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [closed, setClosed] = useState(true);
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("18:00");
  const [reason, setReason] = useState("");
  // Bulk mode: the "Varios días" switch turns day taps into collecting a
  // selection instead of viewing one day. The selection survives
  // flipping months, so days from several months go in one save.
  const [multiMode, setMultiMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const byDate = useMemo(
    () => new Map((exceptions ?? []).map((e) => [e.date, e])),
    [exceptions],
  );
  const existing = byDate.get(selectedISO);
  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const monthCount = useMemo(
    () => (exceptions ?? []).filter((e) => e.date.startsWith(month)).length,
    [exceptions, month],
  );
  const selectedSet = useMemo(() => new Set(selectedDays), [selectedDays]);
  const sortedSelection = useMemo(() => [...selectedDays].sort(), [selectedDays]);
  const selectionExistingCount = useMemo(
    () => sortedSelection.filter((iso) => byDate.has(iso)).length,
    [sortedSelection, byDate],
  );

  // The panel form always reflects the selected day: its saved
  // exception, or the blank defaults for a day without one. It
  // re-initializes when the selection moves or fresh data arrives
  // after a save — never while the Dra is typing, and never in bulk
  // mode, where the form holds the values to apply to the selection.
  useEffect(() => {
    if (multiMode) return;
    setClosed(existing ? existing.is_closed : true);
    setOpen(existing?.open_time?.slice(0, 5) ?? "09:00");
    setClose(existing?.close_time?.slice(0, 5) ?? "18:00");
    setReason(existing?.label ?? "");
  }, [existing, multiMode]);

  if (error) return <p className="error">{error}</p>;
  if (!schedule || !exceptions) return <SkeletonTable rows={7} />;

  async function saveException() {
    const payload = {
      date: selectedISO,
      is_closed: closed,
      open_time: closed ? null : open,
      close_time: closed ? null : close,
      label: reason.trim() || null,
    };
    const { error: saveError } = existing
      ? await supabase.from("date_exceptions").update(payload).eq("id", existing.id)
      : await supabase.from("date_exceptions").insert(payload);
    if (saveError) {
      toast.error(`No se pudo guardar el día especial: ${saveError.message}`);
      return;
    }
    toast.success(existing ? "Día especial actualizado" : "Día especial agregado");
    void reload();
  }

  async function removeException() {
    if (!existing) return;
    const { error: deleteError } = await supabase
      .from("date_exceptions")
      .delete()
      .eq("id", existing.id);
    if (deleteError) {
      toast.error(`No se pudo quitar el día especial: ${deleteError.message}`);
      return;
    }
    toast.success("Día especial eliminado");
    void reload();
  }

  function toggleMultiMode() {
    if (multiMode) {
      // Leaving bulk mode: drop the selection; the form re-syncs to
      // the selected day via the effect above.
      setSelectedDays([]);
      setMultiMode(false);
    } else {
      // Entering bulk mode: start from a clean slate — closed all
      // day, no motivo — instead of the last single day's values.
      setClosed(true);
      setOpen("09:00");
      setClose("18:00");
      setReason("");
      setMultiMode(true);
    }
  }

  function onDayClick(iso: string) {
    if (multiMode) {
      setSelectedDays((prev) =>
        prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso],
      );
    } else {
      setSelectedISO(iso);
    }
  }

  async function applyBulk() {
    const rows = sortedSelection.map((date) => ({
      date,
      is_closed: closed,
      open_time: closed ? null : open,
      close_time: closed ? null : close,
      label: reason.trim() || null,
    }));
    // date is unique, so one upsert writes the whole selection: new
    // days are inserted, days with an exception are updated.
    const { error: saveError } = await supabase
      .from("date_exceptions")
      .upsert(rows, { onConflict: "date" });
    if (saveError) {
      toast.error(`No se pudieron guardar los días: ${saveError.message}`);
      return;
    }
    toast.success(
      `${rows.length} día${rows.length === 1 ? "" : "s"} actualizado${rows.length === 1 ? "" : "s"}`,
    );
    setSelectedDays([]);
    void reload();
  }

  async function removeBulk() {
    const ids = sortedSelection
      .map((iso) => byDate.get(iso)?.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    const { error: deleteError } = await supabase
      .from("date_exceptions")
      .delete()
      .in("id", ids);
    if (deleteError) {
      toast.error(`No se pudieron quitar los días: ${deleteError.message}`);
      return;
    }
    toast.success(
      `${ids.length} día${ids.length === 1 ? "" : "s"} especial${ids.length === 1 ? "" : "es"} eliminado${ids.length === 1 ? "" : "s"}`,
    );
    setSelectedDays([]);
    void reload();
  }

  // The Motivo / Cerrado / hours fields, shared by the single-day
  // panel and the bulk panel — one set of values either way.
  const fields = (
    <>
      <label>
        Motivo
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Feriado, actividad, etc."
        />
      </label>
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
    </>
  );

  return (
    <>
      <h2 className="section-title">Días especiales (feriados, cierres, horarios cortos)</h2>
      <section className="card">
        <div className="spec-cal-wrap">
          <div>
            <div className="spec-multi-row">
              <button
                type="button"
                role="switch"
                aria-checked={multiMode}
                aria-label="Seleccionar varios días"
                className={multiMode ? "switch on" : "switch"}
                onClick={toggleMultiMode}
              >
                <span className="track" aria-hidden="true" />
                <span className="knob" aria-hidden="true" />
              </button>
              <span className="spec-multi-label" onClick={toggleMultiMode}>
                Varios días
              </span>
              {multiMode && selectedDays.length > 0 && (
                <span className="spec-multi-count">
                  {selectedDays.length} seleccionado{selectedDays.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="spec-cal-head">
              <button
                className="spec-cal-nav-btn"
                type="button"
                aria-label="Mes anterior"
                onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
              >
                ‹
              </button>
              <h3 className="spec-cal-title">{grid.title}</h3>
              <button
                className="spec-cal-nav-btn"
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
              >
                ›
              </button>
            </div>
            <div className="spec-cal-weekdays" aria-hidden="true">
              {WEEKDAY_SHORT.map((w) => (
                <span className="spec-cal-weekday" key={w}>
                  {w}
                </span>
              ))}
            </div>
            <div className="spec-cal-grid" role="group" aria-label={grid.title}>
              {grid.cells.map((iso, i) => {
                if (!iso) return <div className="spec-cal-blank" key={`blank-${i}`} />;
                const ex = byDate.get(iso);
                const isToday = iso === today;
                const isSelected = multiMode ? selectedSet.has(iso) : iso === selectedISO;
                const className = [
                  "spec-cal-day",
                  ex?.is_closed ? "spec-cal-day--closed" : "",
                  ex && !ex.is_closed ? "spec-cal-day--short" : "",
                  isToday ? "spec-cal-day--today" : "",
                  isSelected ? "spec-cal-day--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={iso}
                    type="button"
                    className={className}
                    aria-pressed={isSelected}
                    aria-label={`${DAY_NAMES[weekdayOfISO(iso)]}, ${formatDateLongEs(iso)}${ex ? (ex.is_closed ? ", cerrado" : ", horario corto") : ""}${multiMode && isSelected ? ", seleccionado" : ""}`}
                    onClick={() => onDayClick(iso)}
                  >
                    <span className="spec-cal-num">{Number(iso.slice(8, 10))}</span>
                    {ex?.is_closed && <span className="spec-cal-dot closed" aria-hidden="true" />}
                    {ex && !ex.is_closed && (
                      <>
                        <span className="spec-cal-dot short" aria-hidden="true" />
                        <span className="spec-cal-hours">
                          {ex.open_time?.slice(0, 5)}–{ex.close_time?.slice(0, 5)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="spec-cal-foot">
              <span className="spec-cal-legend">
                <span className="spec-cal-dot closed" aria-hidden="true" /> Cerrado
              </span>
              <span className="spec-cal-legend">
                <span className="spec-cal-dot short" aria-hidden="true" /> Horario corto
              </span>
              <span className="spec-cal-count">
                {monthCount === 0
                  ? "Sin días especiales este mes"
                  : `${monthCount} día${monthCount === 1 ? "" : "s"} especial${monthCount === 1 ? "" : "es"} en ${grid.title.split(" de ")[0].toLowerCase()}`}
              </span>
            </div>
          </div>

          <aside className="spec-detail">
            {multiMode ? (
              <>
                {sortedSelection.length === 0 ? (
                  <>
                    <h3>Varios días</h3>
                    <p className="muted">
                      Toca días en el calendario para seleccionarlos. Puedes
                      cambiar de mes sin perder la selección.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>
                      {sortedSelection.length} día{sortedSelection.length === 1 ? "" : "s"}{" "}
                      seleccionado{sortedSelection.length === 1 ? "" : "s"}
                    </h3>
                    <p className="spec-detail-dates">{formatDayList(sortedSelection)}</p>
                    {selectionExistingCount > 0 && (
                      <p className="spec-detail-note">
                        {selectionExistingCount} de {sortedSelection.length} día
                        {sortedSelection.length === 1 ? "" : "s"} ya{" "}
                        {selectionExistingCount === 1 ? "tiene" : "tienen"} excepción — se
                        actualizará{selectionExistingCount === 1 ? "" : "n"}
                      </p>
                    )}
                    <div className="spec-detail-fields">
                      {fields}
                      <div className="spec-detail-actions">
                        <AsyncButton
                          className="btn primary"
                          pendingText="Guardando…"
                          onClick={applyBulk}
                        >
                          Aplicar a {sortedSelection.length} día
                          {sortedSelection.length === 1 ? "" : "s"}
                        </AsyncButton>
                        <AsyncButton
                          className="btn danger-ghost"
                          pendingText="Quitando…"
                          disabled={selectionExistingCount === 0}
                          onClick={removeBulk}
                        >
                          Quitar
                        </AsyncButton>
                      </div>
                      <button
                        type="button"
                        className="spec-detail-clear"
                        onClick={() => setSelectedDays([])}
                      >
                        Limpiar selección
                      </button>
                    </div>
                  </>
                )}
                <p className="spec-detail-hint">
                  Toca un día para agregarlo o quitarlo de la selección.
                </p>
              </>
            ) : (
              <>
                <h3>
                  {DAY_NAMES[weekdayOfISO(selectedISO)]}, {formatDateLongEs(selectedISO)}
                </h3>
                {existing ? (
                  <div className="spec-detail-status">
                    {existing.is_closed ? (
                      <span className="spec-tag closed">Cerrado</span>
                    ) : (
                      <>
                        <span className="spec-tag short">Horario corto</span>
                        <span>
                          {existing.open_time ? formatTime12h(existing.open_time.slice(0, 5)) : ""} –{" "}
                          {existing.close_time ? formatTime12h(existing.close_time.slice(0, 5)) : ""}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="muted">Este día sigue el horario semanal.</p>
                )}
                <div className="spec-detail-fields">
                  {fields}
                  <div className="spec-detail-actions">
                    <AsyncButton
                      className="btn primary"
                      pendingText="Guardando…"
                      onClick={saveException}
                    >
                      {existing ? "Guardar cambios" : "Agregar día especial"}
                    </AsyncButton>
                    {existing && (
                      <AsyncButton
                        className="btn danger-ghost"
                        pendingText="Quitando…"
                        onClick={removeException}
                      >
                        Quitar
                      </AsyncButton>
                    )}
                  </div>
                </div>
                <p className="spec-detail-hint">Haz clic en un día para verlo o agregarlo.</p>
              </>
            )}
          </aside>
        </div>
      </section>

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
          cita puede empezar siempre que su duración completa quepa antes del
          cierre.
        </p>
      </section>
    </>
  );
}
