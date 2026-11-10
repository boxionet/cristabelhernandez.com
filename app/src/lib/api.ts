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

export const ERROR_MESSAGES: Record<string, string> = {
  outside_window:
    "Esta cita ya está dentro de las 24 horas previas: para cambiarla o cancelarla, llámanos o escríbenos.",
  slot_taken: "Ese horario acaba de ocuparse. Elige otra hora, por favor.",
  already_final: "Esta cita ya no se puede modificar.",
  not_found: "No encontramos la cita.",
};

export function errorText(e: unknown): string {
  const key = e instanceof Error ? e.message : "";
  return ERROR_MESSAGES[key] || "Algo salió mal. Inténtalo de nuevo.";
}
