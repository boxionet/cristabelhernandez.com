// Patient-initiated reschedule (manage token or owning session).
// Same 24-hour window as cancel; the database exclusion constraint has
// the final word on conflicts. POST JSON:
//   { manageToken | appointmentId, newDate, newStartTime }
const { serviceClient, json } = require("./_booking/supabase");
const { resolveAppointment, outsideWindow, FINAL_STATUSES } = require("./_booking/manage");
const { sendSimpleEmail, OWNER_EMAIL } = require("./_booking/email");
const { formatDateEs, formatTime12h, clinicNow } = require("./_booking/time");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.newDate || ""))
      return json(400, { error: "bad_date" });
    if (!/^\d{2}:\d{2}$/.test(body.newStartTime || ""))
      return json(400, { error: "bad_time" });
    if (body.newDate < clinicNow().dateISO)
      return json(400, { error: "date_in_past" });

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

    // Approval model: moving a Dra-approved cita to a new slot voids
    // the approval — the new slot goes back to 'pendiente' for the Dra
    // to approve again. Holds and pending requests keep their status.
    const patch = { date: body.newDate, start_time: body.newStartTime };
    const wasApproved = appointment.status === "confirmada";
    if (wasApproved) patch.status = "pendiente";

    const { data: updated, error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", appointment.id)
      .select()
      .single();

    if (error) {
      if (error.code === "23P01") return json(409, { error: "slot_taken" });
      throw error;
    }

    const when = `${formatDateEs(updated.date)} a las ${formatTime12h(String(updated.start_time).slice(0, 5))}`;
    await sendSimpleEmail({
      to: OWNER_EMAIL,
      subject: `Cita reprogramada — ${updated.reference_code}`,
      text: wasApproved
        ? `La cita ${updated.reference_code} se reprogramó para el ${when}. Como estaba confirmada, vuelve a pendiente y requiere aprobación en el Panel.`
        : `La cita ${updated.reference_code} se reprogramó para el ${when}.`,
    });

    return json(200, {
      referenceCode: updated.reference_code,
      status: updated.status,
      date: updated.date,
      startTime: String(updated.start_time).slice(0, 5),
    });
  } catch (e) {
    console.error("booking-reschedule error", e);
    return json(500, { error: "reschedule_failed" });
  }
};
