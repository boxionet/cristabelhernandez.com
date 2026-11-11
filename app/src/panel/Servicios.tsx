import { useState } from "react";
import { formatPrice } from "../lib/format";
import { supabase } from "../lib/supabase";
import { type ServiceRow } from "../lib/panel";
import { usePanelData } from "../lib/queries/panelQueries";
import { SkeletonTable } from "../components/Skeleton";
import AsyncButton from "../components/AsyncButton";
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
  const [active, setActive] = useState(service.active);
  const toast = useToast();

  async function save() {
    const { error } = await supabase
      .from("services")
      .update({
        price,
        duration_minutes: duration,
        price_from: priceFrom,
        price_note: priceNote.trim() || null,
        active,
      })
      .eq("id", service.id);
    if (error) {
      toast.error(`No se pudo guardar ${service.name}: ${error.message}`);
      return;
    }
    toast.success(`${service.name} guardado`);
    onSaved();
  }

  return (
    <tr className={active ? "" : "row-inactive"}>
      <td>
        <strong>{service.name}</strong>
        <br />
        <small className="muted">{service.category}</small>
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
          className="num-input"
        />
      </td>
      <td>
        <label className="check-label">
          <input
            type="checkbox"
            checked={priceFrom}
            onChange={(e) => {
              setPriceFrom(e.target.checked);
            }}
          />
          Desde
        </label>
        <input
          value={priceNote}
          onChange={(e) => {
            setPriceNote(e.target.value);
          }}
          placeholder="c/ampolla, 3 sesiones…"
          className="note-input"
        />
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
          className="num-input"
        />
      </td>
      <td>
        <label className="check-label">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
            }}
          />
          Activo
        </label>
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
  const [category, setCategory] = useState("Facial");
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState(45);
  const [addError, setAddError] = useState<string | null>(null);

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
      category,
      price,
      duration_minutes: duration,
      sort_order: maxOrder + 1,
    });
    if (error) {
      setAddError("No se pudo agregar (¿nombre repetido?).");
      return;
    }
    toast.success("Tratamiento agregado");
    setName("");
    setPrice(0);
    void reload();
  }

  return (
    <>
      <h2 className="section-title">Agregar tratamiento</h2>
      <section className="card form-card">
        <div className="form-grid">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Categoría
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Facial</option>
              <option>Corporal</option>
            </select>
          </label>
          <label>
            Precio (RD$)
            <input
              type="number"
              min={0}
              step={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            Duración (min)
            <input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
            />
          </label>
        </div>
        {addError && <p className="error">{addError}</p>}
        <AsyncButton
          className="btn primary"
          pendingText="Agregando…"
          onClick={addService}
        >
          Agregar
        </AsyncButton>
      </section>

      <h2 className="section-title">Tratamientos (catálogo)</h2>
      <section className="card">
        <table className="table services-table">
          <thead>
            <tr>
              <th>Tratamiento</th>
              <th>Precio (RD$)</th>
              <th>Etiqueta</th>
              <th>Min</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <ServiceEditor key={s.id} service={s} onSaved={() => void reload()} />
            ))}
          </tbody>
        </table>
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
