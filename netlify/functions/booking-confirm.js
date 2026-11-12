// "Verificar mi correo" — the tokenized link in the verification email.
// GET ?token=<uuid> -> confirm_booking RPC -> redirect to the site's
// confirmation page with the outcome in the query string (it renders
// the estado values below). JSON is returned when the caller asks for it.
//
// Approval model: a verified WEB booking lands in 'pendiente'
// (awaiting the Dra), so the page shows the pending-approval state;
// a verified STAFF-created booking lands in 'confirmada' and the
// page shows the confirmed state. (Before the approval model this
// function forwarded the RPC's raw 'confirmed'/'expired' values, which
// the page never matched — the link landing always fell through to
// "Enlace no válido". Fixed here by mapping to the page's values.)
//
// Verify-first: the clinic alert for a web hold fires HERE, once the
// email owner clicks — not at booking creation. The RPC clears the
// token on success, so a repeat click returns 'invalid' and the alert
// can only fire once.
const { serviceClient, siteOrigin } = require("./_booking/supabase");
const { sendOwnerBookingAlert } = require("./_booking/email");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

exports.handler = async (event) => {
  const origin = siteOrigin(event);
  const token = (event.queryStringParameters || {}).token || "";
  const wantsJson = (event.headers.accept || "").includes("application/json");

  function respond(result, referenceCode, status) {
    if (wantsJson) {
      return {
        statusCode: result === "invalid" ? 404 : 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          referenceCode: referenceCode || null,
          status: status || null,
        }),
      };
    }
    // Map the RPC outcome to the confirmation page's estado values.
    const estado =
      result === "confirmed"
        ? status === "confirmada"
          ? "confirmada"
          : "pendiente"
        : result === "expired"
          ? "expirada"
          : "invalid";
    const qs = new URLSearchParams({ estado });
    if (referenceCode) qs.set("ref", referenceCode);
    return {
      statusCode: 302,
      headers: { Location: `${origin}/reservar/confirmacion/?${qs.toString()}` },
      body: "",
    };
  }

  if (!UUID_RE.test(token)) return respond("invalid");

  try {
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("confirm_booking", { p_token: token });
    if (error) throw error;

    // Web hold verified: alert the clinic now that the cita is real and
    // awaiting her decision. Staff holds skip this — the Dra created
    // them, so she already knows. A failed send must never break the
    // redirect; the cita is pendiente in the Panel either way.
    if (data && data.result === "confirmed" && data.status === "pendiente" && data.appointment) {
      try {
        const appt = data.appointment;
        const [patientRes, itemsRes] = await Promise.all([
          supabase.from("patients").select("full_name,email,phone").eq("id", appt.patient_id).maybeSingle(),
          supabase
            .from("appointment_services")
            .select("service_name,unit_price,quantity,price_from,price_note")
            .eq("appointment_id", appt.id),
        ]);
        await sendOwnerBookingAlert({
          appointment: appt,
          items: itemsRes.data || [],
          panelUrl: `${origin}/panel/`,
          patientName: patientRes.data ? patientRes.data.full_name : null,
          patientEmail: patientRes.data ? patientRes.data.email : null,
          patientPhone: patientRes.data ? patientRes.data.phone : null,
          intro:
            "Nueva cita desde la web (la paciente verificó su correo — pendiente de confirmación en el Panel).",
        });
      } catch (e) {
        console.error("owner alert after verification failed", e);
      }
    }

    const ref =
      data && data.appointment ? data.appointment.reference_code : null;
    return respond(data.result, ref, data.status || null);
  } catch (e) {
    console.error("booking-confirm error", e);
    return respond("invalid");
  }
};
