// The Dra marked a cita as paid and chose to ask the patient for a
// Google review. Admin session required — patients can never call
// this. Sends the review-request email (with the clinic's Google
// review link) to the patient's email. Never sends for an unpaid
// cita: payment_status must already be 'pagado', which is exactly
// the state the Panel popup opens from.
const { serviceClient, getAuthUser, isAdmin, json } = require("./_booking/supabase");
const { sendReviewRequestEmail } = require("./_booking/email");

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
    if (appointment.payment_status !== "pagado") {
      return json(409, {
        error: "not_paid",
        payment_status: appointment.payment_status,
      });
    }

    const { data: items } = await supabase
      .from("appointment_services")
      .select("service_name,unit_price,quantity,price_from,price_note")
      .eq("appointment_id", appointment.id);

    const to = appointment.patients?.email || appointment.guest_email || null;
    let emailSent = false;
    if (to) {
      emailSent = await sendReviewRequestEmail({
        appointment,
        items: items || [],
        to,
      });
    }

    return json(200, { emailSent });
  } catch (e) {
    console.error("booking-review-request error", e);
    return json(500, { error: "review_request_failed" });
  }
};
