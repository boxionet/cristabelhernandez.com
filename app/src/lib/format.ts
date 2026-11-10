export function formatPrice(amount: number): string {
  return `RD$ ${Math.round(amount).toLocaleString("en-US")}`;
}

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// '2026-11-16' -> 'lunes 16 de noviembre de 2026' (computed in UTC so
// the viewer's timezone can't shift the day)
export function formatDateEs(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function formatTime12h(hhmmss: string): string {
  const [hRaw, mRaw] = hhmmss.split(":");
  let h = parseInt(hRaw, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mRaw} ${suffix}`;
}

export const STATUS_LABELS: Record<string, string> = {
  por_confirmar: "Por confirmar",
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

// Patient self-service window (settled: 24 hours before the start).
export function canSelfManage(appt: { status: string; starts_at: string }): boolean {
  if (appt.status !== "pendiente" && appt.status !== "confirmada") return false;
  return new Date(appt.starts_at).getTime() - Date.now() >= 24 * 60 * 60 * 1000;
}

export function isUpcoming(appt: { status: string; starts_at: string }): boolean {
  return (
    (appt.status === "pendiente" || appt.status === "confirmada") &&
    new Date(appt.starts_at).getTime() >= Date.now() - 60 * 1000
  );
}
