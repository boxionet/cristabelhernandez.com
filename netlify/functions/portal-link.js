// First-login patient linking for Mi Cuenta (Phase 4).
// A verified Supabase session arrives; this function (service role)
// finds the patient by the verified email — e.g. created earlier by a
// confirmed guest booking — and links auth_user_id, or creates the
// patient row on first login. RLS intentionally gives patients no
// INSERT policy, so this is the only creation path from the portal.
const { serviceClient, getAuthUser, isVerified, json } = require("./_booking/supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  try {
    let user;
    try {
      user = await getAuthUser(event);
    } catch (e) {
      if (e.statusCode === 401) return json(401, { error: "invalid_token" });
      throw e;
    }
    if (!user) return json(401, { error: "auth_required" });
    if (!isVerified(user)) return json(403, { error: "email_not_verified" });

    const supabase = serviceClient();
    const email = user.email.toLowerCase();

    const shape = (p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      phone: p.phone,
    });

    // Already linked to this account?
    const { data: linked } = await supabase
      .from("patients")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (linked) return json(200, { patient: shape(linked), created: false });

    // Existing patient with this verified email (guest booking path)?
    const pattern = email.replace(/[%_\\]/g, "\\$&");
    const { data: byEmail } = await supabase
      .from("patients")
      .select("*")
      .ilike("email", pattern)
      .maybeSingle();
    if (byEmail) {
      if (byEmail.auth_user_id && byEmail.auth_user_id !== user.id) {
        return json(409, { error: "email_linked_elsewhere" });
      }
      const { data: updated, error } = await supabase
        .from("patients")
        .update({ auth_user_id: user.id })
        .eq("id", byEmail.id)
        .select()
        .single();
      if (error) throw error;
      return json(200, { patient: shape(updated), created: false });
    }

    // First login ever: create the patient row.
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (_) {
      body = {};
    }
    const fullName =
      (typeof body.fullName === "string" && body.fullName.trim()) ||
      email.split("@")[0];
    const phone =
      typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    const { data: created, error } = await supabase
      .from("patients")
      .insert({ auth_user_id: user.id, full_name: fullName, email, phone })
      .select()
      .single();
    if (error) throw error;
    return json(200, { patient: shape(created), created: true });
  } catch (e) {
    console.error("portal-link error", e);
    return json(500, { error: "link_failed" });
  }
};
