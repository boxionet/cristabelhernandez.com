import { useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { supabase } from "../lib/supabase";
import { formatPrice } from "../lib/format";
import {
  updateAppointmentServices,
  type PanelAppointment,
  type ServiceRow,
} from "../lib/panel";
import { Skl } from "../components/Skeleton";

interface Line {
  service: ServiceRow;
  quantity: number;
}

// Staff editor for an existing appointment's treatments: add, remove
// or change quantities. Saving recomputes the total and the duration
// from the current catalog (updateAppointmentServices).
export default function AppointmentServicesEditor({
  appt,
  onDone,
  onCancel,
}: {
  appt: PanelAppointment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [catalog, setCatalog] = useState<ServiceRow[] | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data } = await supabase
        .from("services")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!live) return;
      const services = (data ?? []) as ServiceRow[];
      setCatalog(services);
      // Seed the lines from the appointment's current items, matched
      // to the catalog by service_id.
      const seeded: Line[] = [];
      for (const item of appt.appointment_services) {
        const service = services.find((s) => s.id === item.service_id);
        if (service) seeded.push({ service, quantity: item.quantity });
      }
      setLines(seeded);
    })();
    return () => {
      live = false;
    };
  }, [appt]);

  const totals = useMemo(() => {
    let total = 0;
    let duration = 0;
    let estimate = false;
    for (const { service, quantity } of lines ?? []) {
      total += service.price * quantity;
      duration += service.duration_minutes * quantity;
      estimate = estimate || service.price_from || service.price_note !== null;
    }
    return { total, duration, estimate };
  }, [lines]);

  if (!catalog || !lines)
    return (
      <div className="svc-editor" aria-busy="true" aria-label="Cargando">
        <Skl w="55%" />
        <Skl w="82%" style={{ marginTop: 10 }} />
        <Skl w="70%" style={{ marginTop: 10 }} />
      </div>
    );

  const available = catalog.filter(
    (s) => s.active && !lines.some((l) => l.service.id === s.id),
  );

  function setQty(id: string, qty: number) {
    setLines((prev) =>
      (prev ?? []).map((l) =>
        l.service.id === id
          ? { ...l, quantity: Math.min(5, Math.max(1, qty)) }
          : l,
      ),
    );
  }

  function removeLine(id: string) {
    setLines((prev) => (prev ?? []).filter((l) => l.service.id !== id));
  }

  function addLine() {
    const service = available.find((s) => s.id === addId);
    if (!service) return;
    setLines((prev) => [...(prev ?? []), { service, quantity: 1 }]);
    setAddId("");
  }

  async function save() {
    if (lines!.length === 0) {
      setError(
        "La cita debe tener al menos un tratamiento. Para quitarlos todos, cancela la cita.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateAppointmentServices(appt, lines!);
      onDone();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === "23P01"
          ? "Con la nueva duración, la cita choca con otra. Revisa el horario o mueve la cita primero."
          : "No se pudieron guardar los tratamientos.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="svc-editor">
      <p className="svc-editor-title">Tratamientos de esta cita</p>
      {lines.map(({ service, quantity }) => (
        <div key={service.id} className="svc-row">
          <span className="svc-name">
            {service.name}
            <small>
              {service.price_from ? "desde " : ""}
              {formatPrice(service.price)} · {service.duration_minutes} min
            </small>
          </span>
          <span className="svc-qty">
            <button
              type="button"
              className="qty-btn"
              aria-label="Quitar uno"
              onClick={() => setQty(service.id, quantity - 1)}
            >
              <FiMinus aria-hidden />
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              className="qty-btn"
              aria-label="Agregar uno"
              onClick={() => setQty(service.id, quantity + 1)}
            >
              <FiPlus aria-hidden />
            </button>
          </span>
          <button
            type="button"
            className="qty-btn danger"
            aria-label={`Quitar ${service.name}`}
            onClick={() => removeLine(service.id)}
          >
            <FiTrash2 aria-hidden />
          </button>
        </div>
      ))}

      {available.length > 0 && (
        <div className="svc-add">
          <select value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Agregar un tratamiento…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatPrice(s.price)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost small"
            disabled={!addId}
            onClick={addLine}
          >
            Agregar
          </button>
        </div>
      )}

      <div className="svc-footer">
        <span className="muted">
          {totals.estimate ? "Total estimado" : "Total"}:{" "}
          <strong>{formatPrice(totals.total)}</strong> · {totals.duration} min
        </span>
        <span className="svc-footer-btns">
          <button
            type="button"
            className="btn ghost small"
            onClick={onCancel}
            disabled={busy}
          >
            Volver
          </button>
          <button
            type="button"
            className="btn primary small"
            onClick={() => void save()}
            disabled={busy}
          >
            Guardar tratamientos
          </button>
        </span>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
