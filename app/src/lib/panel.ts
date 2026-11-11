import { supabase } from "./supabase";
import type { Appointment } from "./types";

// ---------- Panel data shapes (admin reads via RLS) ----------

export interface PanelAppointment extends Appointment {
  patient_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  internal_notes: string | null;
  source: string;
  confirmation_expires_at: string | null;
  patients: { full_name: string; email: string; phone: string | null } | null;
}

export interface PatientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  no_show_count: number;
  created_at: string;
}

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  price_from: boolean;
  price_note: string | null;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
}

export interface ScheduleRow {
  weekday: number; // 0 = Sunday
  is_open: boolean;
  open_time: string;
  close_time: string;
}

export interface ExceptionRow {
  id: string;
  date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  /** The DB column is `label` (the insert used to send `reason`, which
   * PostgREST rejected — the add silently failed until 2026-11-11). */
  label: string | null;
}

export function clinicToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function displayName(a: PanelAppointment): string {
  return a.patients?.full_name || a.guest_name || "—";
}

export function displayContact(a: PanelAppointment): string {
  return a.patients?.phone || a.patients?.email || a.guest_phone || a.guest_email || "";
}

// A patient is "Nuevo" while they have at most one real booking.
export function isNuevo(patientId: string, all: PanelAppointment[]): boolean {
  const count = all.filter(
    (a) =>
      a.patient_id === patientId &&
      a.status !== "cancelada" &&
      a.status !== "no_show",
  ).length;
  return count <= 1;
}

// ---------- Panel actions (direct RLS writes; staff override) ----------

export async function updateAppointment(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("appointments").update(patch).eq("id", id);
  if (error) throw new Error("update_failed");
}

export async function markNoShow(appt: PanelAppointment): Promise<void> {
  await updateAppointment(appt.id, { status: "no_show" });
  if (appt.patient_id) {
    const { data } = await supabase
      .from("patients")
      .select("no_show_count")
      .eq("id", appt.patient_id)
      .single();
    if (data) {
      await supabase
        .from("patients")
        .update({ no_show_count: (data.no_show_count ?? 0) + 1 })
        .eq("id", appt.patient_id);
    }
  }
}

// Staff confirms a guest hold by phone: same result as the patient
// clicking "Confirmar mi cita" (patient find-or-create by email).
export async function confirmHold(appt: PanelAppointment): Promise<void> {
  let patientId = appt.patient_id;
  if (!patientId && appt.guest_email) {
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .ilike("email", appt.guest_email.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (existing) {
      patientId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("patients")
        .insert({
          full_name: appt.guest_name || appt.guest_email,
          email: appt.guest_email,
          phone: appt.guest_phone,
        })
        .select("id")
        .single();
      if (error) throw new Error("patient_create_failed");
      patientId = created.id;
    }
  }
  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: patientId,
      status: "pendiente",
      confirmation_token: null,
      confirmation_expires_at: null,
      guest_name: null,
      guest_email: null,
      guest_phone: null,
    })
    .eq("id", appt.id);
  if (error) throw new Error("confirm_failed");
}

export async function releaseHold(id: string): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw new Error("delete_failed");
}

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function generateReference(): string {
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += REF_ALPHABET[b % REF_ALPHABET.length];
  return `CH-${code}`;
}

export interface ManualBookingInput {
  patientId?: string | null;
  fullName: string;
  email?: string;
  phone?: string;
  items: { service: ServiceRow; quantity: number }[];
  date: string;
  startTime: string; // 'HH:MM'
  source: "telefono" | "whatsapp" | "presencial";
  note?: string;
}

// Replace an existing appointment's treatments (staff edit). Totals,
// duration and the estimate flag are recomputed from the CURRENT
// catalog, exactly like create_booking. The appointment row is updated
// first so the exclusion constraint re-validates the new time range —
// on a conflict (23P01) nothing else is touched.
export async function updateAppointmentServices(
  appt: PanelAppointment,
  items: { service: ServiceRow; quantity: number }[],
): Promise<void> {
  let total = 0;
  let duration = 0;
  let estimate = false;
  for (const { service, quantity } of items) {
    total += service.price * quantity;
    duration += service.duration_minutes * quantity;
    estimate = estimate || service.price_from || service.price_note !== null;
  }
  const { error: upErr } = await supabase
    .from("appointments")
    .update({
      total_price: total,
      total_is_estimate: estimate,
      duration_minutes: duration,
    })
    .eq("id", appt.id);
  if (upErr) throw upErr;
  const { error: delErr } = await supabase
    .from("appointment_services")
    .delete()
    .eq("appointment_id", appt.id);
  if (delErr) throw delErr;
  const { error: insErr } = await supabase.from("appointment_services").insert(
    items.map(({ service, quantity }) => ({
      appointment_id: appt.id,
      service_id: service.id,
      service_name: service.name,
      unit_price: service.price,
      quantity,
      price_from: service.price_from,
      price_note: service.price_note,
    })),
  );
  if (insErr) throw insErr;
}

// Mirrors create_booking's math (totals/duration/estimate always from
// the catalog) but writes directly with admin RLS rights, so manual
// bookings are confirmed immediately (status pendiente) and email is
// optional (phone-only patients stay as guest data on the appointment).
export async function createManualBooking(
  input: ManualBookingInput,
): Promise<{ referenceCode: string }> {
  let total = 0;
  let duration = 0;
  let estimate = false;
  for (const { service, quantity } of input.items) {
    total += service.price * quantity;
    duration += service.duration_minutes * quantity;
    estimate = estimate || service.price_from || service.price_note !== null;
  }

  let patientId = input.patientId ?? null;
  const email = (input.email || "").trim().toLowerCase();
  if (!patientId && email) {
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .ilike("email", email.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (existing) {
      patientId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("patients")
        .insert({
          full_name: input.fullName.trim(),
          email,
          phone: input.phone?.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw new Error("patient_create_failed");
      patientId = created.id;
    }
  }

  const base = {
    patient_id: patientId,
    guest_name: patientId ? null : input.fullName.trim(),
    guest_email: patientId ? null : email || null,
    guest_phone: patientId ? null : input.phone?.trim() || null,
    date: input.date,
    start_time: input.startTime,
    duration_minutes: duration,
    total_price: total,
    total_is_estimate: estimate,
    status: "pendiente",
    payment_status: "pendiente",
    source: input.source,
    internal_notes: input.note?.trim() || null,
  };

  let lastError: { code?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = generateReference();
    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({ ...base, reference_code: reference })
      .select("id")
      .single();
    if (!error && appt) {
      const items = input.items.map(({ service, quantity }) => ({
        appointment_id: appt.id,
        service_id: service.id,
        service_name: service.name,
        unit_price: service.price,
        quantity,
        price_from: service.price_from,
        price_note: service.price_note,
      }));
      const { error: itemsError } = await supabase
        .from("appointment_services")
        .insert(items);
      if (itemsError) {
        await supabase.from("appointments").delete().eq("id", appt.id);
        throw new Error("items_failed");
      }
      return { referenceCode: reference };
    }
    lastError = error;
    if (error && (error as { code?: string }).code === "23P01") {
      throw new Error("slot_taken");
    }
    if (!error || (error as { code?: string }).code !== "23505") break;
  }
  void lastError;
  throw new Error("create_failed");
}
