// Promo-code check for the booking cart (and the manual Panel form).
// GET ?code=VERANO10[&date=YYYY-MM-DD] answers whether the code can be
// applied — and at what percent — without revealing anything else
// about the promotions table (which has no public read policy).
//
// This is ADVISORY only: the cart shows the discount from it, but the
// authoritative check happens inside create_booking at submit time,
// under a row lock, so a code that dies between check and submit
// still fails the booking with a clear error. The validity window
// compares against the appointment date when one is supplied; without
// a date (the servicios step, picked before the date) only the
// active flag and the use cap are checked.
const { serviceClient, json } = require("./_booking/supabase");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { error: "method_not_allowed" });
    }
    const params = event.queryStringParameters || {};
    const raw = typeof params.code === "string" ? params.code.trim() : "";
    if (!raw || raw.length > 32) {
      return json(400, { error: "bad_code" });
    }
    const date = typeof params.date === "string" ? params.date : null;
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: "bad_date" });
    }
    const code = raw.toUpperCase();
    const supabase = serviceClient();
    const { data: promo, error } = await supabase
      .from("promotions")
      .select("code,discount_percent,active,valid_from,valid_until,max_uses")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!promo || !promo.active) {
      return json(200, { valid: false, reason: "invalid" });
    }
    if (date !== null) {
      if (promo.valid_from && date < promo.valid_from) {
        return json(200, { valid: false, reason: "expired" });
      }
      if (promo.valid_until && date > promo.valid_until) {
        return json(200, { valid: false, reason: "expired" });
      }
    }
    if (promo.max_uses !== null) {
      // Derived usage: appointments carrying the code that were not
      // cancelled. Expired holds are deleted by the sweep, so they
      // stop counting on their own.
      const { count, error: countError } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("promo_code", code)
        .neq("status", "cancelada");
      if (countError) throw countError;
      if ((count ?? 0) >= promo.max_uses) {
        return json(200, { valid: false, reason: "exhausted" });
      }
    }
    return json(200, { valid: true, discountPercent: promo.discount_percent });
  } catch (e) {
    console.error("booking-promo-validate error", e);
    return json(500, { error: "validate_failed" });
  }
};
