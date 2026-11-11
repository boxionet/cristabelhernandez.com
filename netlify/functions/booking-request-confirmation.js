// Ask a patient to confirm a staff-created booking. Admin session
// required. The Panel creates the booking as a 'por_confirmar' hold
// (no token yet); this function mints the token, sets the same expiry
// rule as guest holds — min(24h from now, 3h before the appointment),
// floored so a same-day booking keeps a workable window — and sends
// the patient the confirmation-request email with the tokenized link.
// Clicking the link resolves a staff-created hold straight to
// 'confirmada' (migration 006); an unconfirmed hold is purged by the
// sweep, like any other hold.
const { randomUUID } = require("crypto");
const { serviceClient, getAuthUser, isAdmin, json, siteOrigin } = require("./_booking/supabase");
const { sendConfirmationRequestEmail } = require("./_booking/email");

function holdExpiry(dateISO, startHHMM) {
  // Santo Domingo is UTC-4 year-round, so the clinic wall clock maps
  // to an absolute instant with a fixed offset.
  const start = new Date(`${dateISO}T${startHHMM.slice(0, 5)}:00-04:00`);
  const now = new Date();
  let expiry = new Date(
    Math.min(now.getTime() + 24 * 60 * 60 * 1000, start.getTime() - 3 * 60 * 60 * 1000),
  );
  const floor = new Date(
    Math.max(start.getTime() - 15 * 60 * 1000, now.getTime() + 15 * 60 * 1000),
  );
  if (expiry < floor) expiry = floor;
  return expiry.toISOString();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.appointmentId) return json(400, { error: "bad_request" });

    let user = null;
    try {
      user = await getAuthUser(event);
    } catch (e) {
      if (e.statusCode === 401) return json(401, { error: "invalid_token" });
      throw e;
    }
    if (!isAdmin(user)) return json(403, { error: "not_admin" });

    const supabase = serviceClient();
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("*, patients(email)")
      .eq("id", body.appointmentId)
      .single();
    if (error || !appointment) return json(404, { error: "not_found" });
    if (appointment.status !== "por_confirmar")
      return json(409, { error: "invalid_status", status: appointment.status });

    const to = appointment.patients?.email || appointment.guest_email || null;
    if (!to) return json(400, { error: "no_email" });

    const token = randomUUID();
    const expiresAt = holdExpiry(appointment.date, String(appointment.start_time));
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ confirmation_token: token, confirmation_expires_at: expiresAt })
      .eq("id", appointment.id);
    if (updateError) throw updateError;

    const { data: items } = await supabase
      .from("appointment_services")
      .select("service_name,unit_price,quantity,price_from,price_note")
      .eq("appointment_id", appointment.id);

    const origin = siteOrigin(event);
    const sent = await sendConfirmationRequestEmail({
      appointment,
      items: items || [],
      confirmUrl: `${origin}/.netlify/functions/booking-confirm?token=${token}`,
      portalUrl: `${origin}/mi-cuenta/`,
      to,
    });

    return json(200, { sent, expiresAt });
  } catch (e) {
    console.error("booking-request-confirmation error", e);
    return json(500, { error: "request_failed" });
  }
};
