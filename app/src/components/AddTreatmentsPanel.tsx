import { useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { addAppointmentServices, errorText } from "../lib/api";
import { formatPrice, formatTime12h } from "../lib/format";
import { useToast } from "./Toast";
import type { Appointment } from "../lib/types";

interface CatalogService {
  id: string;
  slug: string;
  name: string;
  price: number;
  duration_minutes: number;
  price_from: boolean;
  price_note: string | null;
  active: boolean;
}

interface Line {
  service: CatalogService;
  quantity: number;
}

// Patient editor: ADD treatments to an existing cita. Existing
// treatments are never removed or changed here — only new services
// can be added, and the change always goes back to 'pendiente' for
// the Dra to confirm (the server enforces that).
export default function AddTreatmentsPanel({
  appointment,
  onDone,
  onClose,
}: {
  appointment: Appointment;
  onDone: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogService[] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
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
      setCatalog((data ?? []) as CatalogService[]);
    })();
    return () => {
      live = false;
    };
  }, []);

  const existingIds = useMemo(
    () =>
      new Set(
        appointment.appointment_services
          .map((i) => i.service_id)
          .filter((id): id is string => id !== null),
      ),
    [appointment],
  );

  const available = useMemo(
    () =>
      (catalog ?? []).filter(
        (s) => s.active && !existingIds.has(s.id) && !lines.some((l) => l.service.id === s.id),
      ),
    [catalog, existingIds, lines],
  );

  // Same math as the server: the booked subtotal is kept, the
  // additions price at the current catalog, and a promo keeps its
  // stored percent re-applied to the new subtotal.
  const preview = useMemo(() => {
    const addedSubtotal = lines.reduce(
      (sum, { service, quantity }) => sum + service.price * quantity,
      0,
    );
    const addedDuration = lines.reduce(
      (sum, { service, quantity }) => sum + service.duration_minutes * quantity,
      0,
    );
    const subtotal = (appointment.subtotal_price ?? appointment.total_price) + addedSubtotal;
    const discount =
      appointment.promo_code && appointment.discount_percent
        ? Math.round((subtotal * appointment.discount_percent) / 100)
        : 0;
    const total = subtotal - discount;
    const duration = appointment.duration_minutes + addedDuration;
    const estimate =
      appointment.total_is_estimate ||
      lines.some((l) => l.service.price_from || l.service.price_note !== null);
    const [h, m] = appointment.start_time.slice(0, 5).split(":").map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    return { total, duration, estimate, endTime };
  }, [lines, appointment]);

  function setQty(id: string, qty: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.service.id === id ? { ...l, quantity: Math.min(5, Math.max(1, qty)) } : l,
      ),
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.service.id !== id));
  }

  function addLine() {
    const service = available.find((s) => s.id === addId);
    if (!service) return;
    setLines((prev) => [...prev, { service, quantity: 1 }]);
    setAddId("");
  }

  async function submit() {
    if (lines.length === 0 || !session) return;
    setBusy(true);
    setError(null);
    try {
      await addAppointmentServices(
        session.access_token,
        appointment.id,
        lines.map(({ service, quantity }) => ({ slug: service.slug, quantity })),
      );
      toast.success("Tratamientos agregados — queda pendiente de confirmación por el centro");
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="add-treatments">
      <p className="muted">
        Agrega tratamientos a esta cita. Los que ya tienes no cambian. Al
        guardar, la cita vuelve a pendiente y el centro debe confirmarla de
        nuevo.
      </p>

      {catalog === null && <p className="muted">Cargando tratamientos…</p>}

      {catalog !== null && available.length === 0 && lines.length === 0 && (
        <p className="muted">Tu cita ya incluye todos los tratamientos disponibles.</p>
      )}

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

      {lines.length > 0 && (
        <div className="svc-footer">
          <span className="muted">
            {preview.estimate ? "Nuevo total estimado" : "Nuevo total"}:{" "}
            <strong>{formatPrice(preview.total)}</strong> · {preview.duration} min · termina{" "}
            {formatTime12h(preview.endTime)}
          </span>
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
          onClick={() => void submit()}
          disabled={lines.length === 0 || busy}
        >
          {busy ? "Guardando…" : "Solicitar agregar tratamientos"}
        </button>
      </div>
    </div>
  );
}
