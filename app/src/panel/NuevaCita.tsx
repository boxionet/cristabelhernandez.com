import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAvailability } from "../lib/queries/availability";
import { requestConfirmation, validatePromo } from "../lib/api";
import { formatPrice, formatTime12h } from "../lib/format";
import {
  clinicToday,
  createManualBooking,
  type ServiceRow,
} from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonForm } from "../components/Skeleton";
import DatePicker from "../components/DatePicker";

export default function NuevaCita() {
  const { patients, services, error, reload } = usePanelData();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState<string>(params.get("paciente") ?? "nuevo");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [date, setDate] = useState(clinicToday());
  const [startTime, setStartTime] = useState<string | null>(null);
  const [source, setSource] = useState<"telefono" | "whatsapp" | "presencial">("telefono");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Promo code for the manual booking (migration 008): validated
  // against the picked date on apply, and re-checked at submit so a
  // date change after applying cannot slip a dead code through.
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{
    code: string;
    discountPercent: number;
  } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    referenceCode: string;
    emailState: "sent" | "failed" | "none";
    email: string;
  } | null>(null);

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
  const discount = promo ? Math.round((total * promo.discountPercent) / 100) : 0;
  const finalTotal = total - discount;

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code || promoChecking) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      const res = await validatePromo(code, date);
      if (res === null) {
        setPromoError("No pudimos verificar el código. Inténtalo de nuevo.");
        return;
      }
      if (!res.valid) {
        setPromoError(
          res.reason === "expired"
            ? "Ese código no aplica para la fecha elegida."
            : res.reason === "exhausted"
              ? "Ese código ya llegó a su límite de usos."
              : "Ese código no es válido. Revisa el código e inténtalo de nuevo.",
        );
        return;
      }
      setPromo({ code, discountPercent: res.discountPercent ?? 0 });
      setPromoInput("");
    } finally {
      setPromoChecking(false);
    }
  }

  // Availability is server state: TanStack Query keyed by date+duration.
  const availability = useAvailability(date, duration, duration > 0);
  const slots: string[] | null =
    duration === 0 || availability.isPending
      ? null
      : (availability.data?.slots ?? []);
  const dayOpen = availability.data?.open ?? true;

  useEffect(() => {
    setStartTime(null);
  }, [date, duration]);

  async function submit() {
    setFormError(null);
    const existing = patients?.find((p) => p.id === patientId);
    if (!existing && fullName.trim().length < 2) {
      setFormError("Escribe el nombre de la paciente.");
      return;
    }
    // The email is required for a new patient: it is how she signs in
    // to her account, and the confirmation email goes to it.
    if (!existing) {
      const em = email.trim();
      if (!em) {
        setFormError(
          "Escribe el correo de la paciente: lo necesita para entrar a su cuenta y confirmar su cita.",
        );
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(em)) {
        setFormError("Revisa el correo: no parece una dirección válida.");
        return;
      }
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
      // Re-check the promo against the final date: the date may have
      // changed after the code was applied.
      let effectivePromo = promo;
      if (promo) {
        const res = await validatePromo(promo.code, date);
        if (res === null) {
          setFormError("No pudimos verificar el código promocional. Inténtalo de nuevo.");
          setBusy(false);
          return;
        }
        if (!res.valid) {
          setPromo(null);
          setFormError(
            "El código promocional ya no es válido para esta cita. Lo quitamos; puedes crear la cita sin descuento o aplicar otro código.",
          );
          setBusy(false);
          return;
        }
        effectivePromo = {
          code: promo.code,
          discountPercent: res.discountPercent ?? promo.discountPercent,
        };
      }
      const effectiveEmail = existing ? existing.email : email.trim();
      const { referenceCode, appointmentId, needsConfirmation } =
        await createManualBooking({
          patientId: existing ? existing.id : null,
          fullName: existing ? existing.full_name : fullName,
          email: existing ? existing.email : email,
          phone: existing ? (existing.phone ?? "") : phone,
          items,
          date,
          startTime,
          source,
          note,
          promo: effectivePromo,
        });
      // Refresh the Panel cache now, so Citas/Agenda show the new
      // cita immediately instead of serving the 30s-stale list.
      reload();
      // With an email the booking is a hold until the patient clicks
      // the confirmation link; without one it is already confirmed.
      // A failed email send must not fail the booking — the Dra can
      // still confirm it from Citas, and the success screen says so.
      let emailState: "sent" | "failed" | "none" = "none";
      if (needsConfirmation) {
        try {
          const r = await requestConfirmation(appointmentId);
          emailState = r.sent ? "sent" : "failed";
        } catch {
          emailState = "failed";
        }
      }
      setDone({ referenceCode, emailState, email: effectiveEmail });
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
  if (!patients || !services) return <SkeletonForm rows={5} />;

  if (done) {
    return (
      <section className="card empty">
        <h2 className="section-title">Cita creada</h2>
        <p>
          Referencia <strong>{done.referenceCode}</strong> · {formatPrice(finalTotal)}
          {done.emailState === "sent" &&
            ` · enviamos un correo a ${done.email} para que la paciente confirme su cita; hasta que confirme, el espacio queda apartado.`}
          {done.emailState === "failed" &&
            " · no pudimos enviar el correo de confirmación. Puedes confirmar la cita desde Citas."}
          {done.emailState === "none" &&
            " · queda confirmada de inmediato (sin correo para confirmar)."}
        </p>
        <Link className="btn primary" to="/panel/agenda">
          Ver la agenda
        </Link>
      </section>
    );
  }

  // The email is required, so every manual booking sends the
  // confirmation email: the button always says so.

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
              Correo *
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="La paciente usa este correo para entrar a su cuenta"
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
            <DatePicker value={date} onChange={setDate} min={clinicToday()} />
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

        <div>
          <label>
            Código promocional (opcional)
            {promo ? (
              <span className="promo-chip">
                {promo.code} · −{promo.discountPercent}%
                <button
                  type="button"
                  className="booking-promo-remove"
                  aria-label="Quitar código promocional"
                  onClick={() => setPromo(null)}
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="booking-promo-row">
                <input
                  className="booking-promo-input"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Código promocional"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="booking-promo-apply-btn"
                  type="button"
                  disabled={!promoInput.trim() || promoChecking}
                  onClick={() => void applyPromo()}
                >
                  {promoChecking ? "Verificando…" : "Aplicar"}
                </button>
              </span>
            )}
          </label>
          {promoError && <p className="error">{promoError}</p>}
        </div>

        {items.length > 0 && (
          <p className="muted">
            Duración total {duration} min · Subtotal {formatPrice(total)}
            {promo && (
              <>
                {" "}· Descuento ({promo.code}) −{formatPrice(discount)}
              </>
            )}{" "}
            · Total {formatPrice(finalTotal)}
          </p>
        )}
        {formError && <p className="error">{formError}</p>}
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> Creando…
            </>
          ) : (
            "Crear cita y enviar confirmación"
          )}
        </button>
      </section>
    </>
  );
}
