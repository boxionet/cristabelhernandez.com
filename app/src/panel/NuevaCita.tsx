import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchSlots } from "../lib/api";
import { formatPrice, formatTime12h } from "../lib/format";
import {
  clinicToday,
  createManualBooking,
  usePanelData,
  type ServiceRow,
} from "../lib/panel";

export default function NuevaCita() {
  const { patients, services, error } = usePanelData();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState<string>(params.get("paciente") ?? "nuevo");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [date, setDate] = useState(clinicToday());
  const [slots, setSlots] = useState<string[] | null>(null);
  const [dayOpen, setDayOpen] = useState(true);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [source, setSource] = useState<"telefono" | "whatsapp" | "presencial">("telefono");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const activeServices = (services ?? []).filter((s) => s.active);
  const items = useMemo(
    () =>
      activeServices
        .filter((s) => (selected[s.id] ?? 0) > 0)
        .map((s) => ({ service: s as ServiceRow, quantity: selected[s.id] })),
    [activeServices, selected],
  );
  const duration = items.reduce(
    (sum, i) => sum + i.service.duration_minutes * i.quantity,
    0,
  );
  const total = items.reduce((sum, i) => sum + i.service.price * i.quantity, 0);

  useEffect(() => {
    if (duration === 0) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    setStartTime(null);
    fetchSlots(date, duration).then((res) => {
      if (cancelled) return;
      if (res) {
        setDayOpen(res.open);
        setSlots(res.slots);
      } else {
        setSlots([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, duration]);

  async function submit() {
    setFormError(null);
    const existing = patients?.find((p) => p.id === patientId);
    if (!existing && fullName.trim().length < 2) {
      setFormError("Escribe el nombre de la paciente.");
      return;
    }
    if (items.length === 0) {
      setFormError("Elige al menos un tratamiento.");
      return;
    }
    if (!startTime) {
      setFormError("Elige la hora de la cita.");
      return;
    }
    setBusy(true);
    try {
      const { referenceCode } = await createManualBooking({
        patientId: existing ? existing.id : null,
        fullName: existing ? existing.full_name : fullName,
        email: existing ? existing.email : email,
        phone: existing ? (existing.phone ?? "") : phone,
        items,
        date,
        startTime,
        source,
        note,
      });
      setDone(referenceCode);
    } catch (e) {
      const key = e instanceof Error ? e.message : "";
      setFormError(
        key === "slot_taken"
          ? "Ese horario acaba de ocuparse. Elige otra hora."
          : "No pudimos crear la cita. Inténtalo de nuevo.",
      );
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!patients || !services) return <p className="muted">Cargando…</p>;

  if (done) {
    return (
      <section className="card empty">
        <h2 className="section-title">Cita creada</h2>
        <p>
          Referencia <strong>{done}</strong> · {formatPrice(total)} · queda
          confirmada de inmediato (sin paso de confirmación por correo).
        </p>
        <Link className="btn primary" to="/panel/agenda">
          Ver la agenda
        </Link>
      </section>
    );
  }

  return (
    <>
      <h2 className="section-title">Nueva cita manual</h2>
      <section className="card form-card">
        <label>
          Paciente
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="nuevo">— Persona nueva / sin registro —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} · {p.email}
              </option>
            ))}
          </select>
        </label>

        {patientId === "nuevo" && (
          <div className="form-grid">
            <label>
              Nombre completo *
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label>
              Teléfono
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>
              Correo (opcional)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Si lo da, su cuenta queda enlazada"
              />
            </label>
          </div>
        )}

        <fieldset className="services-field">
          <legend>Tratamientos</legend>
          {activeServices.map((s) => (
            <div key={s.id} className="service-pick">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={(selected[s.id] ?? 0) > 0}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [s.id]: e.target.checked ? Math.max(1, prev[s.id] ?? 1) : 0,
                    }))
                  }
                />
                {s.name} · {s.price_from ? "desde " : ""}
                {formatPrice(s.price)}
                {s.price_note ? ` ${s.price_note}` : ""} · {s.duration_minutes} min
              </label>
              {(selected[s.id] ?? 0) > 0 && (
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={selected[s.id]}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [s.id]: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                    }))
                  }
                  className="qty-input"
                  aria-label="Cantidad"
                />
              )}
            </div>
          ))}
        </fieldset>

        <div className="form-grid">
          <label>
            Fecha
            <input
              type="date"
              value={date}
              min={clinicToday()}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Fuente
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="telefono">Teléfono</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="presencial">Presencial</option>
            </select>
          </label>
        </div>

        {duration > 0 && slots === null && <p className="muted">Buscando horarios…</p>}
        {duration > 0 && slots !== null && !dayOpen && (
          <p className="muted">El centro está cerrado ese día.</p>
        )}
        {duration > 0 && slots !== null && dayOpen && slots.length === 0 && (
          <p className="muted">No quedan horarios ese día para esta duración.</p>
        )}
        {slots !== null && slots.length > 0 && (
          <div className="slot-grid">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                className={`slot${startTime === s ? " picked" : ""}`}
                onClick={() => setStartTime(s)}
              >
                {formatTime12h(s)}
              </button>
            ))}
          </div>
        )}

        <label>
          Nota interna
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {items.length > 0 && (
          <p className="muted">
            Duración total {duration} min · Total {formatPrice(total)}
          </p>
        )}
        {formError && <p className="error">{formError}</p>}
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Creando…" : "Crear cita confirmada"}
        </button>
      </section>
    </>
  );
}
