// The Dra's decision on a pending online booking. Admin session
// required — patients can never call this. The status change and the
// patient email happen together so the two can never disagree:
//   approve -> status 'confirmada' + approval email (with calendar invite)
//   reject  -> status 'cancelada'  + rejection email + internal note
// Re-deciding an already-decided cita answers the current state and
// never re-sends the email.
const { serviceClient, getAuthUser, isAdmin, json, siteOrigin } = require("./_booking/supabase");
const { sendApprovalEmail, sendRejectionEmail } = require("./_booking/email");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.appointmentId) return json(400, { error: "bad_request" });
    if (body.action !== "approve" && body.action !== "reject")
      return json(400, { error: "bad_action" });

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

    const target = body.action === "approve" ? "confirmada" : "cancelada";
    if (appointment.status === target) {
      return json(200, { status: target, already: true, emailSent: false });
    }
    if (appointment.status !== "pendiente") {
      return json(409, { error: "invalid_status", status: appointment.status });
    }

    const patch = { status: target };
    if (body.action === "reject") {
      const prev = (appointment.internal_notes || "").trim();
      patch.internal_notes = prev
        ? `${prev}\nNo confirmada por el centro.`
        : "No confirmada por el centro.";
    }
    const { error: updateError } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", appointment.id);
    if (updateError) throw updateError;

    const { data: items } = await supabase
      .from("appointment_services")
      .select("service_name,unit_price,quantity,price_from,price_note")
      .eq("appointment_id", appointment.id);

    const to = appointment.patients?.email || appointment.guest_email || null;
    let emailSent = false;
    if (to) {
      const origin = siteOrigin(event);
      const args = {
        appointment: { ...appointment, status: target },
        items: items || [],
        portalUrl: `${origin}/mi-cuenta/`,
        to,
      };
      emailSent =
        body.action === "approve"
          ? await sendApprovalEmail(args)
          : await sendRejectionEmail(args);
    }

    return json(200, { status: target, already: false, emailSent });
  } catch (e) {
    console.error("booking-decide error", e);
    return json(500, { error: "decide_failed" });
  }
};
