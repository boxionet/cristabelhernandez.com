// Pure time helpers for the booking engine — clinic wall clock is
// America/Santo_Domingo (UTC-4, no DST). Kept dependency-free so the
// slot math can be unit-tested outside the functions.

const CLINIC_TZ = "America/Santo_Domingo";
const SLOT_STEP_MINUTES = 15;

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime12h(hhmm) {
  let [h, m] = String(hhmm).split(":").map((n) => parseInt(n, 10));
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Available start times ("HH:MM") for one day.
// busy: [{start: minutes, end: minutes}] in clinic wall-clock minutes.
// When isToday, starts must be in the future (nowMinutes).
function computeSlots({ openTime, closeTime, durationMinutes, busy, isToday = false, nowMinutes = 0 }) {
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  const slots = [];
  for (let start = open; start + durationMinutes <= close; start += SLOT_STEP_MINUTES) {
    if (isToday && start <= nowMinutes) continue;
    const end = start + durationMinutes;
    const blocked = busy.some((b) => rangesOverlap(start, end, b.start, b.end));
    if (!blocked) slots.push(minutesToTime(start));
  }
  return slots;
}

// "Now" in the clinic timezone: { dateISO: 'YYYY-MM-DD', minutes }
function clinicNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10),
  };
}

// Weekday (0 = Sunday … 6 = Saturday) for a YYYY-MM-DD date, computed in
// UTC so the host timezone can't shift it.
function weekdayOf(dateISO) {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

function addDays(dateISO, days) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// '2026-11-20' -> 'viernes 20 de noviembre de 2026'
function formatDateEs(dateISO) {
  const [y, m, d] = dateISO.split("-").map((n) => parseInt(n, 10));
  return `${WEEKDAYS_ES[weekdayOf(dateISO)]} ${d} de ${MONTHS_ES[m - 1]} de ${y}`;
}

module.exports = {
  CLINIC_TZ,
  SLOT_STEP_MINUTES,
  timeToMinutes,
  minutesToTime,
  formatTime12h,
  rangesOverlap,
  computeSlots,
  clinicNow,
  weekdayOf,
  addDays,
  formatDateEs,
};
