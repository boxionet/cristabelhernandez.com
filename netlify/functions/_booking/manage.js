// Shared resolution + rules for patient-initiated cancel/reschedule.
// Two ways in, per the plan's impersonation guard:
//   * the manage_token from the patient's own email link, or
//   * a Supabase session that owns the appointment (portal).
// Staff changes go through the Panel (RLS admin write), never here.
const { getAuthUser } = require("./supabase");

async function resolveAppointment(supabase, event, body) {
  if (body.manageToken) {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("manage_token", body.manageToken)
      .maybeSingle();
    return data || null;
  }
  if (body.appointmentId) {
    const user = await getAuthUser(event); // throws 401 on a bad token
    if (!user) return null;
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!patient) return null;
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", body.appointmentId)
      .eq("patient_id", patient.id)
      .maybeSingle();
    return data || null;
  }
  return null;
}

const FINAL_STATUSES = ["cancelada", "completada", "no_show"];

// 24-hour window (settled): patient self-service is blocked once the
// appointment starts in less than 24h. Unconfirmed holds can be
// released at any time (they are not confirmed bookings yet).
function outsideWindow(appointment, now = new Date()) {
  if (appointment.status === "por_confirmar") return false;
  const start = new Date(appointment.starts_at).getTime();
  return start - now.getTime() < 24 * 60 * 60 * 1000;
}

module.exports = { resolveAppointment, outsideWindow, FINAL_STATUSES };
