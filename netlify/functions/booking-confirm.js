// "Confirmar mi cita" — the tokenized link in the guest's email.
// GET ?token=<uuid> -> confirm_booking RPC -> redirect to the site's
// confirmation page with the outcome in the query string (Phase 3
// renders it). JSON is returned when the caller asks for it.
const { serviceClient, siteOrigin } = require("./_booking/supabase");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

exports.handler = async (event) => {
  const origin = siteOrigin(event);
  const token = (event.queryStringParameters || {}).token || "";
  const wantsJson = (event.headers.accept || "").includes("application/json");

  function respond(result, referenceCode) {
    if (wantsJson) {
      return {
        statusCode: result === "invalid" ? 404 : 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, referenceCode: referenceCode || null }),
      };
    }
    const qs = new URLSearchParams({ estado: result });
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
    const ref =
      data && data.appointment ? data.appointment.reference_code : null;
    return respond(data.result, ref);
  } catch (e) {
    console.error("booking-confirm error", e);
    return respond("invalid");
  }
};
