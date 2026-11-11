import {
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiTag,
} from "react-icons/fi";
import { formatDateShortEs, formatPrice } from "../lib/format";
import {
  useAppointments,
  useServicesCatalog,
} from "../lib/queries/patientQueries";
import { SkeletonCards } from "../components/Skeleton";

interface Aggregate {
  name: string;
  times: number;
  lastDate: string;
  spent: number;
  duration: number | null;
}

export default function Tratamientos() {
  const { rows, error } = useAppointments();
  const catalog = useServicesCatalog();

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <SkeletonCards count={3} />;

  const durationById = new Map(
    (catalog.data ?? []).map((s) => [s.id, s.duration_minutes]),
  );

  const byService = new Map<string, Aggregate>();
  for (const appt of rows) {
    if (appt.status === "cancelada" || appt.status === "no_show") continue;
    for (const item of appt.appointment_services) {
      const agg = byService.get(item.service_name) ?? {
        name: item.service_name,
        times: 0,
        lastDate: appt.date,
        spent: 0,
        duration: item.service_id
          ? (durationById.get(item.service_id) ?? null)
          : null,
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
  const totalSpent = list.reduce((s, t) => s + t.spent, 0);

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
          <article key={t.name} className="card treat2">
            <div className="treat2-head">
              <h3>{t.name}</h3>
              <div className="treat2-count">
                <span className="treat2-n">×{t.times}</span>
                <span className="treat2-l">
                  {t.times === 1 ? "sesión registrada" : "sesiones registradas"}
                </span>
              </div>
            </div>
            <div className="treat2-meta">
              <p>
                <FiCalendar aria-hidden /> Última cita:{" "}
                <strong>{formatDateShortEs(t.lastDate)}</strong>
              </p>
              {t.duration !== null && (
                <p>
                  <FiClock aria-hidden /> Duración por sesión:{" "}
                  <strong>{t.duration} min</strong>
                </p>
              )}
            </div>
            <div className="treat2-foot">
              <span className="treat2-spent">
                <span className="treat2-spent-l">Total invertido</span>
                <span className="treat2-spent-v">{formatPrice(t.spent)}</span>
              </span>
              <a className="btn ghost" href="/reservar/">
                Reservar de nuevo <FiArrowRight aria-hidden />
              </a>
            </div>
          </article>
        ))}
      </section>

      {list.length > 0 && (
        <section className="kpis treat-summary">
          <div className="card kpi kpi-flex">
            <span className="kpi-ic">
              <FiCreditCard aria-hidden />
            </span>
            <span>
              <span className="kpi-value">{formatPrice(totalSpent)}</span>
              <span className="kpi-label">Invertido en tus tratamientos</span>
            </span>
          </div>
          <div className="card kpi kpi-flex">
            <span className="kpi-ic">
              <FiTag aria-hidden />
            </span>
            <span>
              <span className="kpi-value">{list.length}</span>
              <span className="kpi-label">Tratamientos diferentes</span>
            </span>
          </div>
        </section>
      )}
    </>
  );
}
