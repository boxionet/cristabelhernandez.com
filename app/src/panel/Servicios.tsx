import { useEffect, useRef, useState } from "react";
import { formatPrice } from "../lib/format";
import { supabase } from "../lib/supabase";
import { type ServiceRow } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonTable } from "../components/Skeleton";
import AsyncButton from "../components/AsyncButton";
import { FiPlus } from "react-icons/fi";
import { useToast } from "../components/Toast";

function ServiceEditor({
  service,
  onSaved,
}: {
  service: ServiceRow;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(service.price);
  const [duration, setDuration] = useState(service.duration_minutes);
  const [priceFrom, setPriceFrom] = useState(service.price_from);
  const [priceNote, setPriceNote] = useState(service.price_note ?? "");
  const [description, setDescription] = useState(service.description ?? "");
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

  // Every field saves itself — on blur, or immediately for the checkbox —
  // and the switch saves the on/off state the moment it flips, so there
  // is no pending state anywhere on the page: what the row shows is what
  // the database holds. A failed save reverts the field to the stored
  // value instead of leaving a lie on screen.
  async function savePatch(
    patch: Record<string, string | number | boolean | null>,
    revert: () => void,
  ) {
    setSaveState("saving");
    setSaveError(null);
    const { error } = await supabase
      .from("services")
      .update(patch)
      .eq("id", service.id);
    if (error) {
      revert();
      setSaveError(error.message);
      setSaveState("error");
      toast.error(`No se pudo guardar ${service.name}: ${error.message}`);
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

  function savePrice() {
    if (price === service.price) return;
    const prev = service.price;
    void savePatch({ price }, () => setPrice(prev));
  }

  function saveDuration() {
    if (duration === service.duration_minutes) return;
    const prev = service.duration_minutes;
    void savePatch({ duration_minutes: duration }, () => setDuration(prev));
  }

  function saveDescription() {
    const next = description.trim() || null;
    if (next === service.description) return;
    const prev = service.description ?? "";
    void savePatch({ description: next }, () => setDescription(prev));
  }

  function saveNote() {
    const next = priceNote.trim() || null;
    if (next === service.price_note) return;
    const prev = service.price_note ?? "";
    void savePatch({ price_note: next }, () => setPriceNote(prev));
  }

  function togglePriceFrom(checked: boolean) {
    setPriceFrom(checked);
    const prev = service.price_from;
    void savePatch({ price_from: checked }, () => setPriceFrom(prev));
  }

  async function toggleActive() {
    if (toggling) return;
    const next = !service.active;
    setToggling(true);
    const { error } = await supabase
      .from("services")
      .update({ active: next })
      .eq("id", service.id);
    setToggling(false);
    if (error) {
      toast.error(
        `No se pudo ${next ? "activar" : "desactivar"} ${service.name}: ${error.message}`,
      );
      return;
    }
    toast.success(`${service.name} ${next ? "activado" : "desactivado"}`);
    onSaved();
  }

  return (
    <tr className={service.active ? "" : "row-inactive"}>
      <td>
        <strong>{service.name}</strong>{" "}
        <span className="catsep">- {service.category}</span>
        {!service.active && (
          <span className="tag-inactive">Inactivo</span>
        )}
        <br />
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          onBlur={saveDescription}
          placeholder="Descripción que verán las pacientes…"
          rows={2}
          className="desc-input"
          aria-label={`Descripción de ${service.name}`}
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          step={100}
          value={price}
          onChange={(e) => {
            setPrice(Number(e.target.value) || 0);
          }}
          onBlur={savePrice}
          className="num-input"
        />
      </td>
      <td>
        <div className="etiqueta-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={priceFrom}
              onChange={(e) => {
                togglePriceFrom(e.target.checked);
              }}
            />
            Desde
          </label>
          <input
            value={priceNote}
            onChange={(e) => {
              setPriceNote(e.target.value);
            }}
            onBlur={saveNote}
            placeholder="c/ampolla, 3 sesiones…"
            className="note-input"
          />
        </div>
      </td>
      <td>
        <input
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => {
            setDuration(Number(e.target.value) || 0);
          }}
          onBlur={saveDuration}
          className="num-input"
        />
      </td>
      <td>
        <div className="switch-cell">
          <button
            type="button"
            role="switch"
            aria-checked={service.active}
            aria-label={`${service.active ? "Desactivar" : "Activar"} ${service.name}`}
            className={service.active ? "switch on" : "switch"}
            disabled={toggling}
            onClick={() => void toggleActive()}
          >
            <span className="track" aria-hidden />
            <span className="knob" aria-hidden />
          </button>
          <span className="state-word">
            {service.active ? "Activo" : "Inactivo"}
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Servicios() {
  const toast = useToast();
  const { services, error, reload } = usePanelData();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("facial");
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState(45);
  const [description, setDescription] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "activos" | "inactivos">(
    "todos",
  );

  if (error) return <p className="error">{error}</p>;
  if (!services) return <SkeletonTable rows={6} />;

  async function addService() {
    setAddError(null);
    if (name.trim().length < 3 || price <= 0) {
      setAddError("Escribe el nombre y un precio válido.");
      return;
    }
    const maxOrder = (services ?? []).reduce(
      (m, s) => Math.max(m, s.sort_order),
      0,
    );
    const { error } = await supabase.from("services").insert({
      slug: slugify(name),
      name: name.trim(),
      description: description.trim() || null,
      category,
      price,
      duration_minutes: duration,
      sort_order: maxOrder + 1,
    });
    if (error) {
      // Show the real reason instead of a generic guess: a slug
      // collision (23505) means a repeated name; anything else is
      // reported verbatim so the next failure explains itself.
      if (error.code === "23505") {
        setAddError("Ya existe un tratamiento con ese nombre.");
      } else {
        setAddError(`No se pudo agregar: ${error.message}`);
      }
      return;
    }
    toast.success("Tratamiento agregado");
    setName("");
    setDescription("");
    setPrice(0);
    void reload();
  }

  const shown = services.filter(
    (s) => filter === "todos" || (filter === "activos") === s.active,
  );
  const activeCount = services.filter((s) => s.active).length;

  return (
    <>
      <h2 className="section-title">Agregar tratamiento</h2>
      <section className="card form-card">
        <div className="add-row">
          <label className="add-field grow">
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="add-field mid">
            Categoría
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="facial">Facial</option>
              <option value="corporal">Corporal</option>
            </select>
          </label>
          <label className="add-field num">
            Precio (RD$)
            <input
              type="number"
              min={0}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </label>
          <label className="add-field num">
            Duración (min)
            <input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
            />
          </label>
          <AsyncButton
            className="btn primary"
            pendingText="Agregando…"
            onClick={addService}
          >
            <FiPlus /> Agregar
          </AsyncButton>
        </div>
        <div className="add-row">
          <label className="add-field grow">
            Descripción (opcional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="La línea que verán las pacientes debajo del tratamiento…"
              rows={2}
            />
          </label>
        </div>
        {addError && <p className="error">{addError}</p>}
      </section>

      <h2 className="section-title">Tratamientos (catálogo)</h2>
      <div
        className="service-filters"
        role="group"
        aria-label="Filtrar tratamientos por estado"
      >
        <button
          type="button"
          className={filter === "todos" ? "filter-chip active" : "filter-chip"}
          onClick={() => setFilter("todos")}
        >
          Todos <span className="n">{services.length}</span>
        </button>
        <button
          type="button"
          className={
            filter === "activos" ? "filter-chip active" : "filter-chip"
          }
          onClick={() => setFilter("activos")}
        >
          Activos <span className="n">{activeCount}</span>
        </button>
        <button
          type="button"
          className={
            filter === "inactivos" ? "filter-chip active" : "filter-chip"
          }
          onClick={() => setFilter("inactivos")}
        >
          Inactivos <span className="n">{services.length - activeCount}</span>
        </button>
      </div>
      <section className="card">
        <div className="table-scroll">
          <table className="table services-table">
          <thead>
            <tr>
              <th>Tratamiento</th>
              <th>Precio (RD$)</th>
              <th>Etiqueta</th>
              <th>Min</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {filter === "activos"
                    ? "No hay tratamientos activos."
                    : "No hay tratamientos inactivos."}
                </td>
              </tr>
            ) : (
              shown.map((s) => (
                <ServiceEditor
                  key={s.id}
                  service={s}
                  onSaved={() => void reload()}
                />
              ))
            )}
          </tbody>
          </table>
        </div>
        <p className="muted">
          Los cambios se reflejan enseguida en la página de servicios y en el
          portal. Desactivar un tratamiento lo oculta de la web sin borrar su
          historial. Precios de referencia: la Toxina Frontal está en{" "}
          {formatPrice(13000)}.
        </p>
      </section>
    </>
  );
}
