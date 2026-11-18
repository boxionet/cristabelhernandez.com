import { useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { editAppointmentServices, errorText } from "../lib/api";
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

// Patient editor for a cita's treatments, in two modes behind two
// card buttons so the patient sees both jobs upfront instead of
// discovering one inside the other:
//   * "add" — only adds NEW services (existing ones are carried
//     through unchanged and listed as a read-only summary);
//   * "edit" — only changes what is already on the cita (remove or
//     change quantities), with no add control.
// Both modes send the full desired list to the server, which
// recomputes the totals from the catalog. Every save goes back to
// 'pendiente' for the Dra to confirm.
export default function EditTreatmentsPanel({
  appointment,
  mode,
  onDone,
  onClose,
}: {
  appointment: Appointment;
  mode: "add" | "edit";
  onDone: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogService[] | null>(null);
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
      const services = (data ?? []) as CatalogService[];
      setCatalog(services);
      // Seed the lines from the appointment's current items, matched
      // to the catalog by service_id (inactive services seed too, so
      // a kept treatment is never dropped by a re-save).
      const seeded: Line[] = [];
      for (const item of appointment.appointment_services) {
        const service = services.find((s) => s.id === item.service_id);
        if (service) seeded.push({ service, quantity: item.quantity });
      }
      setLines(seeded);
    })();
    return () => {
      live = false;
    };
  }, [appointment]);

  const available = useMemo(
    () =>
      (catalog ?? []).filter(
        (s) => s.active && !(lines ?? []).some((l) => l.service.id === s.id),
      ),
    [catalog, lines],
  );

  // The original list, for the no-changes guard: same services with
  // the same quantities means there is nothing to confirm.
  const originalKey = useMemo(
    () =>
      appointment.appointment_services
        .map((i) => `${i.service_id}:${i.quantity}`)
        .sort()
        .join("|"),
    [appointment],
  );
  const changed = useMemo(() => {
    if (!lines) return false;
    const key = lines
      .map((l) => `${l.service.id}:${l.quantity}`)
      .sort()
      .join("|");
    return key !== originalKey;
  }, [lines, originalKey]);

  // Same math as the server and the Panel editor: the whole list
  // re-prices at the current catalog, and a promo keeps its stored
  // percent re-applied to the new subtotal.
  const preview = useMemo(() => {
    const subtotal = (lines ?? []).reduce(
      (sum, { service, quantity }) => sum + service.price * quantity,
      0,
    );
    const duration = (lines ?? []).reduce(
      (sum, { service, quantity }) => sum + service.duration_minutes * quantity,
      0,
    );
    const discount =
      appointment.promo_code && appointment.discount_percent
        ? Math.round((subtotal * appointment.discount_percent) / 100)
        : 0;
    const total = subtotal - discount;
    const estimate = (lines ?? []).some(
      (l) => l.service.price_from || l.service.price_note !== null,
    );
    const [h, m] = appointment.start_time.slice(0, 5).split(":").map(Number);
    const endMinutes = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    return { total, duration, estimate, endTime };
  }, [lines, appointment]);

  // The services the cita already has: in "add" mode only the NEW
  // lines are shown with controls; the originals ride along
  // unchanged and are summarized in one line instead. These memos
  // must stay above the early return — hooks after a conditional
  // return crash React on the re-render that loads the catalog.
  const originalIds = useMemo(
    () =>
      new Set(
        appointment.appointment_services
          .map((i) => i.service_id)
          .filter((id): id is string => id !== null),
      ),
    [appointment],
  );
  const visibleLines = useMemo(
    () =>
      mode === "add"
        ? (lines ?? []).filter((l) => !originalIds.has(l.service.id))
        : (lines ?? []),
    [mode, lines, originalIds],
  );

  if (!catalog || !lines)
    return (
      <div className="edit-treatments" aria-busy="true" aria-label="Cargando">
        <p className="muted">Cargando tratamientos…</p>
      </div>
    );

  function setQty(id: string, qty: number) {
    setLines((prev) =>
      (prev ?? []).map((l) =>
        l.service.id === id ? { ...l, quantity: Math.min(5, Math.max(1, qty)) } : l,
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

  async function submit() {
    if (lines!.length === 0) {
      setError(
        "La cita debe tener al menos un tratamiento. Para quitarlos todos, cancela la cita.",
      );
      return;
    }
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await editAppointmentServices(
        session.access_token,
        appointment.id,
        lines!.map(({ service, quantity }) => ({ slug: service.slug, quantity })),
      );
      toast.success("Tratamientos actualizados — queda pendiente de confirmación por el centro");
      onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="edit-treatments">
      <p className="muted">
        {mode === "add"
          ? "Agrega tratamientos a esta cita. Los que ya tienes no cambian. Al guardar, la cita vuelve a pendiente y el centro debe confirmarla de nuevo."
          : "Quita tratamientos o cambia las cantidades de esta cita. Al guardar, la cita vuelve a pendiente y el centro debe confirmarla de nuevo."}
      </p>

      {mode === "add" && (
        <p className="muted">
          Tu cita ya incluye:{" "}
          {appointment.appointment_services
            .map(
              (i) => `${i.service_name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`,
            )
            .join(", ")}
          .
        </p>
      )}

      {mode === "add" && available.length === 0 && visibleLines.length === 0 && (
        <p className="muted">Tu cita ya incluye todos los tratamientos disponibles.</p>
      )}

      {visibleLines.map(({ service, quantity }) => (
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

      {/* In "edit" mode the add control appears only as a recovery:
          if the patient removed every treatment, they can add one
          back without leaving the panel (saving an empty list stays
          blocked). */}
      {(mode === "add" || lines.length === 0) && available.length > 0 && (
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
          {changed
            ? preview.estimate
              ? "Nuevo total estimado"
              : "Nuevo total"
            : preview.estimate
              ? "Total estimado"
              : "Total"}
          : <strong>{formatPrice(preview.total)}</strong> · {preview.duration} min · termina{" "}
          {formatTime12h(preview.endTime)}
        </span>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="reschedule-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
          Volver
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => void submit()}
          disabled={!changed || busy}
        >
          {busy ? "Guardando…" : "Solicitar cambios"}
        </button>
      </div>
    </div>
  );
}
