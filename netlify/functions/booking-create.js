// Create a booking. All invariants live in the create_booking RPC
// (migration 003): totals from the catalog, idempotency, patient
// matching by verified email, guest holds as 'por_confirmar'.
// This layer validates input, resolves the caller's identity, maps
// database errors to API errors, and sends the emails.
const { serviceClient, getAuthUser, isVerified, json, siteOrigin } = require("./_booking/supabase");
const { sendOwnerBookingAlert, sendPatientVerificationEmail } = require("./_booking/email");
const { verifyRecaptcha } = require("./_booking/captcha");
const { clinicNow } = require("./_booking/time");
const { randomUUID } = require("crypto");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body) {
  if (!body || typeof body !== "object") return "bad_body";
  if (!body.name || String(body.name).trim().length < 2) return "bad_name";
  if (!EMAIL_RE.test(String(body.email || ""))) return "bad_email";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) return "bad_date";
  if (!/^\d{2}:\d{2}$/.test(body.startTime || "")) return "bad_time";
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 10)
    return "bad_items";
  for (const item of body.items) {
    if (!item || typeof item.slug !== "string") return "bad_items";
    const q = item.quantity == null ? 1 : parseInt(item.quantity, 10);
    if (!q || q < 1 || q > 5) return "bad_items";
  }
  const today = clinicNow().dateISO;
  if (body.date < today) return "date_in_past";
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    const invalid = validate(body);
    if (invalid) return json(400, { error: invalid });

    // Identity: a valid Supabase session with a verified email books as
    // 'verified'; no session books as a guest. A present-but-invalid
    // token is an error, never a silent downgrade.
    let user = null;
    try {
      user = await getAuthUser(event);
    } catch (e) {
      if (e.statusCode === 401) return json(401, { error: "invalid_token" });
      throw e;
    }
    const verified = isVerified(user);
    const email = verified ? user.email : String(body.email).trim().toLowerCase();

    // Bot protection (Phase 6): guest creates must pass reCAPTCHA.
    // Verified sessions are identity-bound and skip it. When the check
    // fails the client falls back to the legacy email flow (until the
    // Phase 7 cutover removes that path).
    if (!user) {
      const captcha = await verifyRecaptcha(
        body.captchaToken,
        event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"],
      );
      if (captcha.configured && !captcha.success) {
        return json(403, { error: "captcha_failed" });
      }
    }

    const supabase = serviceClient();
    const { data: appointment, error } = await supabase.rpc("create_booking", {
      p_items: body.items.map((i) => ({
        slug: i.slug,
        quantity: i.quantity == null ? 1 : parseInt(i.quantity, 10),
      })),
      p_date: body.date,
      p_start_time: body.startTime,
      p_name: String(body.name).trim(),
      p_email: email,
      p_phone: body.phone ? String(body.phone).trim() : null,
      p_verified: verified,
      p_auth_user_id: verified ? user.id : null,
      p_idempotency_key: body.idempotencyKey || randomUUID(),
      p_source: "web",
    });

    if (error) {
      if (error.code === "23P01") return json(409, { error: "slot_taken" });
      if (error.message && error.message.includes("unknown_service"))
        return json(400, { error: "unknown_service" });
      if (error.message && error.message.includes("invalid_items"))
        return json(400, { error: "bad_items" });
      console.error("create_booking failed", error);
      return json(500, { error: "create_failed" });
    }

    // Idempotent replay (same key submitted again): the RPC returns the
    // original row. Answer with it, but never re-send the emails.
    const isReplay =
      Date.now() - new Date(appointment.created_at).getTime() > 10000;
    if (isReplay) {
      return json(200, {
        referenceCode: appointment.reference_code,
        status: appointment.status,
        date: appointment.date,
        startTime: String(appointment.start_time).slice(0, 5),
        totalPrice: appointment.total_price,
        totalIsEstimate: appointment.total_is_estimate,
        confirmationExpiresAt: appointment.confirmation_expires_at,
        replay: true,
      });
    }

    // A patient note from the form becomes an internal note for the Dra.
    if (body.note && String(body.note).trim()) {
      await supabase
        .from("appointments")
        .update({ internal_notes: String(body.note).trim().slice(0, 1000) })
        .eq("id", appointment.id);
    }

    // Line items for the emails (price snapshot taken at booking).
    const { data: items } = await supabase
      .from("appointment_services")
      .select("service_name,unit_price,quantity,price_from,price_note")
      .eq("appointment_id", appointment.id);

    const origin = siteOrigin(event);
    const confirmUrl = appointment.confirmation_token
      ? `${origin}/.netlify/functions/booking-confirm?token=${appointment.confirmation_token}`
      : null;
    // Verify-first: a guest hold sends ONLY the verification email to
    // the patient — the clinic alert fires from booking-confirm once
    // the email owner clicks the link. A verified booking skips
    // verification, so its clinic alert fires now.
    const emailResults = { owner: false, patient: false };
    if (verified) {
      emailResults.owner = await sendOwnerBookingAlert({
        appointment,
        items: items || [],
        panelUrl: `${origin}/panel/`,
        patientName: String(body.name).trim(),
        patientEmail: email,
        patientPhone: body.phone ? String(body.phone).trim() : null,
        intro:
          "Nueva cita desde la web (paciente verificada — pendiente de confirmación en el Panel).",
      });
    } else if (confirmUrl) {
      emailResults.patient = await sendPatientVerificationEmail({
        appointment,
        items: items || [],
        confirmUrl,
        portalUrl: `${origin}/mi-cuenta/`,
        to: email,
      });
    }

    return json(201, {
      referenceCode: appointment.reference_code,
      status: appointment.status,
      date: appointment.date,
      startTime: String(appointment.start_time).slice(0, 5),
      totalPrice: appointment.total_price,
      totalIsEstimate: appointment.total_is_estimate,
      confirmationExpiresAt: appointment.confirmation_expires_at,
      email: emailResults,
    });
  } catch (e) {
    console.error("booking-create error", e);
    return json(500, { error: "create_failed" });
  }
};
