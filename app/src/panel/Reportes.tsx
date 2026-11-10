import { useMemo, useState } from "react";
import { formatPrice, STATUS_LABELS } from "../lib/format";
import { clinicToday, usePanelData } from "../lib/panel";

export default function Reportes() {
  const { appointments, error } = usePanelData();
  const [month, setMonth] = useState(clinicToday().slice(0, 7));

  const data = useMemo(() => {
    if (!appointments) return null;
    const inMonth = appointments.filter((a) => a.date.startsWith(month));
    const cobrado = inMonth
      .filter((a) => a.payment_status === "pagado" && a.status !== "cancelada")
      .reduce((s, a) => s + a.total_price, 0);
    const porCobrar = inMonth
      .filter(
        (a) =>
          a.payment_status === "pendiente" &&
          (a.status === "pendiente" ||
            a.status === "confirmada" ||
            a.status === "completada"),
      )
      .reduce((s, a) => s + a.total_price, 0);
    const reservado = inMonth
      .filter((a) => a.status !== "cancelada" && a.status !== "no_show")
      .reduce((s, a) => s + a.total_price, 0);
    const byStatus = Object.keys(STATUS_LABELS).map((status) => ({
      status,
      count: inMonth.filter((a) => a.status === status).length,
    }));
    const byService = new Map<string, { count: number; revenue: number }>();
    for (const a of inMonth) {
      if (a.status === "cancelada") continue;
      for (const item of a.appointment_services) {
        const agg = byService.get(item.service_name) ?? { count: 0, revenue: 0 };
        agg.count += item.quantity;
        agg.revenue += item.unit_price * item.quantity;
        byService.set(item.service_name, agg);
      }
    }
    return {
      inMonth,
      cobrado,
      porCobrar,
      reservado,
      byStatus,
      byService: [...byService.entries()].sort((x, y) => y[1].revenue - x[1].revenue),
    };
  }, [appointments, month]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando reportes…</p>;

  return (
    <>
      <div className="agenda-head">
        <h2 className="section-title">Reportes</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <section className="kpis">
        <div className="card kpi">
          <span className="kpi-value">{formatPrice(data.cobrado)}</span>
          <span className="kpi-label">Efectivo cobrado</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{formatPrice(data.porCobrar)}</span>
          <span className="kpi-label">Efectivo por cobrar</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{formatPrice(data.reservado)}</span>
          <span className="kpi-label">Total reservado del mes</span>
        </div>
      </section>

      <section className="dash-grid">
        <div className="card">
          <h3>Citas por estado</h3>
          <table className="table">
            <tbody>
              {data.byStatus.map((row) => (
                <tr key={row.status}>
                  <td>
                    <span className={`pill status-${row.status}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Por tratamiento</h3>
          {data.byService.length === 0 && (
            <p className="muted">Sin citas este mes.</p>
          )}
          <table className="table">
            <tbody>
              {data.byService.map(([name, agg]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="nowrap">{agg.count} ses.</td>
                  <td className="nowrap">{formatPrice(agg.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
