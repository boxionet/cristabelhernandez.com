// Patient-initiated cancellation (manage token or owning session).
// Enforces the settled 24-hour window; staff override lives in the
// Panel. POST JSON: { manageToken } or { appointmentId } + session.
const { serviceClient, json } = require("./_booking/supabase");
const { resolveAppointment, outsideWindow, FINAL_STATUSES } = require("./_booking/manage");
const { sendSimpleEmail, OWNER_EMAIL } = require("./_booking/email");
const { formatDateEs, formatTime12h } = require("./_booking/time");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    const supabase = serviceClient();

    let appointment;
    try {
      appointment = await resolveAppointment(supabase, event, body);
    } catch (e) {
      if (e.statusCode === 401) return json(401, { error: "invalid_token" });
      throw e;
    }
    if (!appointment) return json(404, { error: "not_found" });
    if (FINAL_STATUSES.includes(appointment.status))
      return json(409, { error: "already_final" });
    if (outsideWindow(appointment))
      return json(403, { error: "outside_window" });

    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelada" })
      .eq("id", appointment.id);
    if (error) throw error;

    const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(String(appointment.start_time).slice(0, 5))}`;
    await sendSimpleEmail({
      to: OWNER_EMAIL,
      subject: `Cita cancelada — ${appointment.reference_code}`,
      text: `La paciente canceló su cita ${appointment.reference_code} (${when}) desde el enlace de su correo o su cuenta. El espacio quedó libre.`,
    });

    return json(200, { referenceCode: appointment.reference_code, status: "cancelada" });
  } catch (e) {
    console.error("booking-cancel error", e);
    return json(500, { error: "cancel_failed" });
  }
};
