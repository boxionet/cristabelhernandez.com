import { formatDateEs, formatPrice } from "../lib/format";
import { useAppointments } from "../lib/useAppointments";

interface Aggregate {
  name: string;
  times: number;
  lastDate: string;
  spent: number;
}

export default function Tratamientos() {
  const { rows, error } = useAppointments();

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p className="muted">Cargando tus tratamientos…</p>;

  const byService = new Map<string, Aggregate>();
  for (const appt of rows) {
    if (appt.status === "cancelada" || appt.status === "no_show") continue;
    for (const item of appt.appointment_services) {
      const agg = byService.get(item.service_name) ?? {
        name: item.service_name,
        times: 0,
        lastDate: appt.date,
        spent: 0,
      };
      agg.times += item.quantity;
      if (appt.date > agg.lastDate) agg.lastDate = appt.date;
      agg.spent += item.unit_price * item.quantity;
      byService.set(item.service_name, agg);
    }
  }
  const list = [...byService.values()].sort((a, b) =>
    b.lastDate.localeCompare(a.lastDate),
  );

  return (
    <>
      <h2 className="section-title">Mis tratamientos</h2>
      {list.length === 0 && (
        <section className="card empty">
          <p>
            Cuando reserves tu primera cita, aquí verás tus tratamientos y tu
            progreso.
          </p>
          <a className="btn primary" href="/reservar/">
            Reservar una cita
          </a>
        </section>
      )}
      <section className="treat-grid">
        {list.map((t) => (
          <article key={t.name} className="card treat">
            <h3>{t.name}</h3>
            <p className="muted">
              {t.times} {t.times === 1 ? "sesión registrada" : "sesiones registradas"}
            </p>
            <p className="muted">Última: {formatDateEs(t.lastDate)}</p>
            <p className="treat-spent">{formatPrice(t.spent)}</p>
          </article>
        ))}
      </section>
    </>
  );
}
