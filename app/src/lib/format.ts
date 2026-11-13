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

// '2026-12-13' -> '13 de diciembre de 2026' — the Dominican long form
// (owner's requested headline format: no weekday, lowercase "de").
export function formatDateLongEs(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// '2026-11-13' -> '13 nov 2026'
export function formatDateShortEs(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

// Phone display, shared everywhere a phone number is shown: NANP
// (+1) numbers only, formatted as "+1 (829) 316-3313" or
// "(829) 316-3313". Safe on any stored value — digits are re-derived,
// so an already-formatted number comes back unchanged.
export function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    if (digits.length <= 1) return "+" + digits;
    if (digits.length <= 4) return "+" + digits.slice(0, 1) + " (" + digits.slice(1);
    if (digits.length <= 7) {
      return "+" + digits.slice(0, 1) + " (" + digits.slice(1, 4) + ") " + digits.slice(4);
    }
    return (
      "+" + digits.slice(0, 1) + " (" + digits.slice(1, 4) + ") " +
      digits.slice(4, 7) + "-" + digits.slice(7, 11)
    );
  }
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length > 1) {
    const countryCode = digits.slice(0, 1);
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    if (digits.length <= 1) return "+" + countryCode;
    if (digits.length <= 4) return "+" + countryCode + " (" + areaCode;
    if (digits.length <= 7) return "+" + countryCode + " (" + areaCode + ") " + exchange;
    return "+" + countryCode + " (" + areaCode + ") " + exchange + "-" + line;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6, 10);
}

export function capitalizeFirst(s: string): string {
  return s.replace(/^./, (c) => c.toUpperCase());
}

/** The clinic-timezone (America/Santo_Domingo) calendar date of an instant. */
export function toClinicDateISO(instantISO: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instantISO));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Clinic "today" (America/Santo_Domingo) as YYYY-MM-DD. */
export function clinicTodayISO(): string {
  return toClinicDateISO(new Date().toISOString());
}

/** Whole days from the clinic's today until the given clinic date. */
export function daysUntilClinic(dateISO: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dateISO) - toUtc(clinicTodayISO())) / 86_400_000);
}

export function formatTime12h(hhmmss: string): string {
  const [hRaw, mRaw] = hhmmss.split(":");
  let h = parseInt(hRaw, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mRaw} ${suffix}`;
}

/** '2026-11-13T19:00:00+00:00' -> '13 nov 2026, 3:00 PM' (clinic timezone). */
export function formatDateTimeShortEs(instantISO: string): string {
  const date = formatDateShortEs(toClinicDateISO(instantISO));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(instantISO));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${date}, ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

/** '2026-11-13T19:00:00+00:00' -> '3:00 PM' (clinic timezone). */
export function formatTimeShortEs(instantISO: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(instantISO));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

export const STATUS_LABELS: Record<string, string> = {
  por_confirmar: "Esperando verificación",
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
