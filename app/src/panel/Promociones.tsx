import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { type PromotionRow } from "../lib/panel";
import {
  usePanelData,
  usePanelPromotions,
} from "../lib/queries/panelQueries";
import { SkeletonTable } from "../components/Skeleton";
import AsyncButton from "../components/AsyncButton";
import DatePicker from "../components/DatePicker";
import { formatDateShortEs } from "../lib/format";
import { FiPlus } from "react-icons/fi";
import { useToast } from "../components/Toast";

// Promo codes (migration 008), managed with the same pattern as the
// Tratamientos catalog: every field saves itself, the switch flips
// the state the moment it moves, and there are no Guardar buttons.
// The code itself is never editable — once shared, a code must keep
// meaning the same thing. Deactivation (not deletion) retires a code;
// appointments already made keep their frozen discount snapshot.

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function PromotionEditor({
  promotion,
  usesCount,
  onSaved,
}: {
  promotion: PromotionRow;
  usesCount: number;
  onSaved: () => void;
}) {
  const [percent, setPercent] = useState(promotion.discount_percent);
  const [validFrom, setValidFrom] = useState(promotion.valid_from ?? "");
  const [validUntil, setValidUntil] = useState(promotion.valid_until ?? "");
  const [maxUses, setMaxUses] = useState(
    promotion.max_uses === null ? "" : String(promotion.max_uses),
  );
  const [toggling, setToggling] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const toast = useToast();
  const savedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current !== null) {
        window.clearTimeout(savedTimer.current);
      }
    },
    [],
  );

  async function savePatch(
    patch: Record<string, string | number | boolean | null>,
    revert: () => void,
  ) {
    setSaveState("saving");
    setSaveError(null);
    const { error } = await supabase
      .from("promotions")
      .update(patch)
      .eq("id", promotion.id);
    if (error) {
      revert();
      setSaveError(error.message);
      setSaveState("error");
      toast.error(`No se pudo guardar ${promotion.code}: ${error.message}`);
      return;
    }
    setSaveState("saved");
    if (savedTimer.current !== null) {
      window.clearTimeout(savedTimer.current);
    }
    savedTimer.current = window.setTimeout(
      () => setSaveState("idle"),
      2500,
    );
    onSaved();
  }

  function savePercent() {
    const parsed = Math.round(Number(percent));
    if (!Number.isFinite(parsed)) {
      setPercent(promotion.discount_percent);
      return;
    }
    const clamped = Math.min(100, Math.max(1, parsed));
    setPercent(clamped);
    if (clamped === promotion.discount_percent) return;
    const prev = promotion.discount_percent;
    void savePatch({ discount_percent: clamped }, () => setPercent(prev));
  }

  function saveDate(
    field: "valid_from" | "valid_until",
    value: string,
    current: { from: string; until: string },
  ) {
    const next = value || null;
    const stored = field === "valid_from" ? promotion.valid_from : promotion.valid_until;
    if (next === stored) return;
    const from = field === "valid_from" ? value : current.from;
    const until = field === "valid_until" ? value : current.until;
    if (from && until && from > until) {
      toast.error("La fecha inicial no puede ser posterior a la final.");
      if (field === "valid_from") setValidFrom(stored ?? "");
      else setValidUntil(stored ?? "");
      return;
    }
    const prev = stored ?? "";
    void savePatch({ [field]: next }, () => {
      if (field === "valid_from") setValidFrom(prev);
      else setValidUntil(prev);
    });
  }

  function saveMaxUses() {
    const trimmed = maxUses.trim();
    if (trimmed === "") {
      if (promotion.max_uses === null) return;
      const prev = String(promotion.max_uses);
      void savePatch({ max_uses: null }, () => setMaxUses(prev));
      return;
    }
    const parsed = Math.round(Number(trimmed));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setMaxUses(
        promotion.max_uses === null ? "" : String(promotion.max_uses),
      );
      return;
    }
    if (parsed === promotion.max_uses) return;
    const prev =
      promotion.max_uses === null ? "" : String(promotion.max_uses);
    setMaxUses(String(parsed));
    void savePatch({ max_uses: parsed }, () => setMaxUses(prev));
  }

  async function toggleActive() {
    if (toggling) return;
    const next = !promotion.active;
    setToggling(true);
    const { error } = await supabase
      .from("promotions")
      .update({ active: next })
      .eq("id", promotion.id);
    setToggling(false);
    if (error) {
      toast.error(
        `No se pudo ${next ? "activar" : "desactivar"} ${promotion.code}: ${error.message}`,
      );
      return;
    }
    toast.success(`${promotion.code} ${next ? "activado" : "desactivado"}`);
    onSaved();
  }

  return (
    <tr className={promotion.active ? "" : "row-inactive"}>
      <td>
        <strong className="promo-code">{promotion.code}</strong>
        {!promotion.active && (
          <span className="tag-inactive">Inactivo</span>
        )}
      </td>
      <td>
        <span className="pct-wrap">
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => {
              setPercent(Number(e.target.value) || 0);
            }}
            onBlur={savePercent}
            className="num-input"
            aria-label={`Descuento de ${promotion.code} en por ciento`}
          />
          <span className="pct-suffix">%</span>
        </span>
      </td>
      <td>
        <div className="promo-dates">
          <DatePicker
            value={validFrom}
            placeholder="Sin fecha"
            clearable
            displayFormat={formatDateShortEs}
            ariaLabel={`Válido desde de ${promotion.code}`}
            onChange={(iso) => {
              setValidFrom(iso);
              saveDate("valid_from", iso, {
                from: iso,
                until: validUntil,
              });
            }}
          />
          <span className="date-sep">–</span>
          <DatePicker
            value={validUntil}
            placeholder="Sin fecha"
            clearable
            displayFormat={formatDateShortEs}
            ariaLabel={`Válido hasta de ${promotion.code}`}
            onChange={(iso) => {
              setValidUntil(iso);
              saveDate("valid_until", iso, {
                from: validFrom,
                until: iso,
              });
            }}
          />
        </div>
      </td>
      <td>
        <span className="uses-wrap">
          <span className="uses-count">{usesCount}</span>
          <span className="uses-of">de</span>
          <input
            type="number"
            min={1}
            step={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            onBlur={saveMaxUses}
            placeholder="Sin límite"
            className="uses-input"
            aria-label={`Límite de usos de ${promotion.code}`}
          />
        </span>
      </td>
      <td>
        <div className="switch-cell">
          <button
            type="button"
            role="switch"
            aria-checked={promotion.active}
            aria-label={`${promotion.active ? "Desactivar" : "Activar"} ${promotion.code}`}
            className={promotion.active ? "switch on" : "switch"}
            disabled={toggling}
            onClick={() => void toggleActive()}
          >
            <span className="track" aria-hidden />
            <span className="knob" aria-hidden />
          </button>
          <span className="state-word">
            {promotion.active ? "Activo" : "Inactivo"}
          </span>
        </div>
        {saveState === "saving" && (
          <p className="save-caption">Guardando…</p>
        )}
        {saveState === "saved" && <p className="save-caption">Guardado</p>}
        {saveState === "error" && saveError && (
          <p className="save-caption error">{saveError}</p>
        )}
      </td>
    </tr>
  );
}

export default function Promociones() {
  const toast = useToast();
  const { appointments, error: panelError, reload } = usePanelData();
  const promotionsQuery = usePanelPromotions();
  const promotions = promotionsQuery.data ?? null;
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState(10);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "activas" | "inactivas">(
    "todas",
  );

  // Uses are derived: appointments carrying the code that were not
  // cancelled. Expired holds are deleted by the sweep, so they stop
  // counting on their own.
  const usesByCode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of appointments ?? []) {
      if (!a.promo_code || a.status === "cancelada") continue;
      counts.set(a.promo_code, (counts.get(a.promo_code) ?? 0) + 1);
    }
    return counts;
  }, [appointments]);

  if (panelError || promotionsQuery.isError)
    return <p className="error">No pudimos cargar las promociones. Recarga la página.</p>;
  if (!promotions || !appointments) return <SkeletonTable rows={4} />;

  async function addPromotion() {
    setAddError(null);
    const normalized = normalizeCode(code);
    if (!CODE_PATTERN.test(normalized)) {
      setAddError(
        "El código debe tener de 3 a 20 caracteres: solo letras, números o guiones.",
      );
      return;
    }
    const pct = Math.round(Number(percent));
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      setAddError("El descuento debe estar entre 1% y 100%.");
      return;
    }
    if (validFrom && validUntil && validFrom > validUntil) {
      setAddError("La fecha inicial no puede ser posterior a la final.");
      return;
    }
    const limit = maxUses.trim();
    const parsedLimit = limit === "" ? null : Math.round(Number(limit));
    if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit < 1)) {
      setAddError("El límite de usos debe ser un número mayor que cero, o vacío para sin límite.");
      return;
    }
    const { error } = await supabase.from("promotions").insert({
      code: normalized,
      discount_percent: pct,
      active: true,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      max_uses: parsedLimit,
    });
    if (error) {
      if (error.code === "23505") {
        setAddError("Ya existe una promoción con ese código.");
      } else {
        setAddError(`No se pudo agregar: ${error.message}`);
      }
      return;
    }
    toast.success(`Promoción ${normalized} agregada`);
    setCode("");
    setPercent(10);
    setValidFrom("");
    setValidUntil("");
    setMaxUses("");
    void reload();
  }

  const shown = promotions.filter(
    (p) => filter === "todas" || (filter === "activas") === p.active,
  );
  const activeCount = promotions.filter((p) => p.active).length;

  return (
    <>
      <h2 className="section-title">Agregar promoción</h2>
      <section className="card form-card">
        <div className="add-row">
          <label className="add-field grow">
            Código
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="VERANO10"
            />
          </label>
          <label className="add-field num">
            Descuento (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value) || 0)}
            />
          </label>
          <label className="add-field date">
            Válido desde
            <DatePicker
              value={validFrom}
              placeholder="Sin fecha"
              clearable
              displayFormat={formatDateShortEs}
              onChange={setValidFrom}
            />
          </label>
          <label className="add-field date">
            Válido hasta
            <DatePicker
              value={validUntil}
              placeholder="Sin fecha"
              clearable
              displayFormat={formatDateShortEs}
              onChange={setValidUntil}
            />
          </label>
          <label className="add-field num">
            Límite de usos
            <input
              type="number"
              min={1}
              step={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Sin límite"
            />
          </label>
          <AsyncButton
            className="btn primary"
            pendingText="Agregando…"
            onClick={addPromotion}
          >
            <FiPlus /> Agregar
          </AsyncButton>
        </div>
        {addError && <p className="error">{addError}</p>}
      </section>

      <h2 className="section-title">Promociones</h2>
      <div
        className="service-filters"
        role="group"
        aria-label="Filtrar promociones por estado"
      >
        <button
          type="button"
          className={filter === "todas" ? "filter-chip active" : "filter-chip"}
          onClick={() => setFilter("todas")}
        >
          Todas <span className="n">{promotions.length}</span>
        </button>
        <button
          type="button"
          className={
            filter === "activas" ? "filter-chip active" : "filter-chip"
          }
          onClick={() => setFilter("activas")}
        >
          Activas <span className="n">{activeCount}</span>
        </button>
        <button
          type="button"
          className={
            filter === "inactivas" ? "filter-chip active" : "filter-chip"
          }
          onClick={() => setFilter("inactivas")}
        >
          Inactivas <span className="n">{promotions.length - activeCount}</span>
        </button>
      </div>
      <section className="card">
        <div className="table-scroll">
          <table className="table services-table promo-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descuento</th>
                <th>Vigencia</th>
                <th>Usos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    {promotions.length === 0
                      ? "Todavía no hay promociones. Agrega la primera arriba."
                      : filter === "activas"
                        ? "No hay promociones activas."
                        : "No hay promociones inactivas."}
                  </td>
                </tr>
              ) : (
                shown.map((p) => (
                  <PromotionEditor
                    key={p.id}
                    promotion={p}
                    usesCount={usesByCode.get(p.code) ?? 0}
                    onSaved={() => void reload()}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
