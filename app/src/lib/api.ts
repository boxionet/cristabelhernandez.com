import { supabase } from "./supabase";
import type { Patient } from "./types";

// Calls to the Netlify booking functions, always with the patient's
// Supabase session token — the functions resolve ownership from it.

async function callFunction(
  name: string,
  accessToken: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export async function linkPatient(
  accessToken: string,
): Promise<{ patient: Patient; created: boolean }> {
  const { ok, status, data } = await callFunction("portal-link", accessToken, {});
  if (!ok) {
    throw new Error(typeof data.error === "string" ? data.error : `link_${status}`);
  }
  return data as unknown as { patient: Patient; created: boolean };
}

export async function cancelAppointment(
  accessToken: string,
  appointmentId: string,
): Promise<void> {
  const { ok, data } = await callFunction("booking-cancel", accessToken, {
    appointmentId,
  });
  if (!ok) {
    throw new Error(typeof data.error === "string" ? data.error : "cancel_failed");
  }
}

export async function rescheduleAppointment(
  accessToken: string,
  appointmentId: string,
  newDate: string,
  newStartTime: string,
): Promise<void> {
  const { ok, data } = await callFunction("booking-reschedule", accessToken, {
    appointmentId,
    newDate,
    newStartTime,
  });
  if (!ok) {
    throw new Error(typeof data.error === "string" ? data.error : "reschedule_failed");
  }
}

// Staff-only function calls: the session is read here so Panel
// components don't thread the token through the card tree.
async function staffCallFunction(
  name: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("no_session");
  return callFunction(name, token, body);
}

// The Dra's decision on a pending request (booking-decide): the
// status change and the patient email happen together, server-side.
export async function decideAppointment(
  appointmentId: string,
  action: "approve" | "reject",
): Promise<{ status: string; emailSent: boolean }> {
  const { ok, data } = await staffCallFunction("booking-decide", {
    appointmentId,
    action,
  });
  if (!ok) {
    throw new Error(typeof data.error === "string" ? data.error : "decide_failed");
  }
  return data as unknown as { status: string; emailSent: boolean };
}

// Ask a patient to confirm a staff-created booking
// (booking-request-confirmation): mints the token, sets the hold
// expiry, and sends the confirmation-request email.
export async function requestConfirmation(
  appointmentId: string,
): Promise<{ sent: boolean }> {
  const { ok, data } = await staffCallFunction("booking-request-confirmation", {
    appointmentId,
  });
  if (!ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "request_failed",
    );
  }
  return data as unknown as { sent: boolean };
}

// Public availability (no auth needed) for the reschedule picker.
export async function fetchSlots(
  dateISO: string,
  durationMinutes: number,
): Promise<{ open: boolean; slots: string[] } | null> {
  try {
    const res = await fetch(
      `/.netlify/functions/booking-availability?date=${encodeURIComponent(dateISO)}&durationMinutes=${durationMinutes}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as { open: boolean; slots: string[] };
  } catch {
    return null;
  }
}

// --- Public booking flow (Phase 3: React migration) -------------------
// These calls carry NO session by default: the caller attaches the
// patient's token when signed in (verified booking) or a captcha
// token when booking without an account. createBooking reports every
// HTTP outcome instead of throwing, so the caller can map 409
// (slot_taken) and 401 (stale session) to their own flows; it throws
// only on network failure.

export interface CreateBookingItem {
  slug: string;
  quantity: number;
}

export interface CreateBookingPayload {
  name: string;
  email: string;
  phone: string;
  note?: string;
  items: CreateBookingItem[];
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24h)
  idempotencyKey: string;
  captchaToken?: string | null;
  promoCode?: string | null;
}

export interface CreateBookingOutcome {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

export async function createBooking(
  payload: CreateBookingPayload,
  accessToken?: string | null,
): Promise<CreateBookingOutcome> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch("/.netlify/functions/booking-create", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export interface DayAvailability {
  date: string;
  open: boolean;
  available: boolean;
}

// Per-day open/available flags for a date range (the booking date
// carousel), for the cart's total duration.
export async function fetchDayRange(
  fromISO: string,
  toISO: string,
  durationMinutes: number,
): Promise<DayAvailability[] | null> {
  try {
    const res = await fetch(
      `/.netlify/functions/booking-availability?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&durationMinutes=${durationMinutes}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { days?: DayAvailability[] };
    return data.days ?? null;
  } catch {
    return null;
  }
}

export interface BookingSummaryItem {
  service_name: string;
  unit_price: number;
  quantity: number;
  price_from: boolean;
  price_note: string | null;
}

export interface BookingSummary {
  referenceCode: string;
  status: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  totalPrice: number;
  totalIsEstimate: boolean;
  // Promo snapshot (migration 008); nulls when no code was applied.
  promoCode: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  subtotalPrice: number | null;
  confirmationExpiresAt: string | null;
  patientName: string | null;
  items: BookingSummaryItem[];
}

// Server-driven confirmation lookup: the reference code is the
// capability (it only ever travels in the patient's own email and in
// the redirect that follows a validated link click). The response
// carries NO contact details — name, date, services and total only.
export async function fetchBookingSummary(
  referenceCode: string,
): Promise<BookingSummary | null> {
  try {
    const res = await fetch(
      `/.netlify/functions/booking-lookup?ref=${encodeURIComponent(referenceCode)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as BookingSummary;
  } catch {
    return null;
  }
}

export interface PromoValidation {
  valid: boolean;
  discountPercent?: number;
  reason?: "invalid" | "expired" | "exhausted";
}

// Advisory promo check for the cart (the authoritative check runs in
// create_booking at submit). With a date, the validity window is
// checked against the appointment date; without one, only the active
// flag and the use cap are checked. Returns null on transport error.
export async function validatePromo(
  code: string,
  date?: string | null,
): Promise<PromoValidation | null> {
  try {
    const params = new URLSearchParams({ code });
    if (date) params.set("date", date);
    const res = await fetch(
      `/.netlify/functions/booking-promo-validate?${params.toString()}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as PromoValidation;
  } catch {
    return null;
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  outside_window:
    "Esta cita ya está dentro de las 24 horas previas: para cambiarla o cancelarla, llámanos o escríbenos.",
  slot_taken: "Ese horario acaba de ocuparse. Elige otra hora, por favor.",
  already_final: "Esta cita ya no se puede modificar.",
  not_found: "No encontramos la cita.",
  invalid_promo:
    "Ese código promocional ya no es válido. Quítalo o verifica el código e inténtalo de nuevo.",
  promo_exhausted:
    "Ese código promocional ya llegó a su límite de usos. Quítalo para continuar sin descuento.",
};

export function errorText(e: unknown): string {
  const key = e instanceof Error ? e.message : "";
  return ERROR_MESSAGES[key] || "Algo salió mal. Inténtalo de nuevo.";
}
