// Scheduled sweep: purge holds that were never confirmed
// (decision B — expired 'por_confirmar' rows release their slot).
// Runs every 15 minutes via Netlify Scheduled Functions.
//
// Expired holds are not silently dropped: the Dra gets one digest
// email per run listing what expired, so she knows the slot freed and
// can follow up with the patient to rebook. Candidates and their
// services are read BEFORE the purge (line items cascade-delete with
// the appointment), and the digest lists only holds confirmed purged:
// ids are re-checked after the purge, so a hold confirmed in between
// is never reported as expired. A hold expiring in the millisecond
// between the read and the purge would miss the digest — negligible
// at this volume.
const { serviceClient, siteOrigin } = require("./_booking/supabase");
const { sendOwnerExpiredHoldsDigest } = require("./_booking/email");

exports.config = { schedule: "*/15 * * * *" };

exports.handler = async (event) => {
  try {
    const supabase = serviceClient();
    const nowISO = new Date().toISOString();
    // Candidates: expired holds, with patient identity from the
    // linked row (manual holds) or the guest fields (web holds).
    const { data: candidates, error: readError } = await supabase
      .from("appointments")
      .select(
        "id,reference_code,date,start_time,duration_minutes,total_price,total_is_estimate,source,guest_name,guest_email,guest_phone,patients(full_name,email,phone)",
      )
      .eq("status", "por_confirmar")
      .lt("confirmation_expires_at", nowISO);
    if (readError) throw readError;

    // Services for the digest, one query — before the purge deletes
    // them with the appointment rows.
    const candidateIds = (candidates || []).map((c) => c.id);
    const servicesByAppt = new Map();
    if (candidateIds.length > 0) {
      const { data: services } = await supabase
        .from("appointment_services")
        .select(
          "appointment_id,service_name,unit_price,quantity,price_from,price_note",
        )
        .in("appointment_id", candidateIds);
      for (const s of services || []) {
        if (!servicesByAppt.has(s.appointment_id)) {
          servicesByAppt.set(s.appointment_id, []);
        }
        servicesByAppt.get(s.appointment_id).push(s);
      }
    }

    const { data: purged, error } = await supabase.rpc("purge_expired_holds");
    if (error) throw error;

    let emailed = 0;
    if (candidateIds.length > 0) {
      // Re-check: only holds that actually vanished were purged.
      const { data: remaining } = await supabase
        .from("appointments")
        .select("id")
        .in("id", candidateIds);
      const remainingIds = new Set((remaining || []).map((r) => r.id));
      const expired = (candidates || []).filter((c) => !remainingIds.has(c.id));
      if (expired.length > 0) {
        const holds = expired.map((h) => ({
          reference_code: h.reference_code,
          date: h.date,
          start_time: h.start_time,
          duration_minutes: h.duration_minutes,
          total_price: h.total_price,
          total_is_estimate: h.total_is_estimate,
          source: h.source,
          patientName: h.patients?.full_name || h.guest_name || null,
          patientEmail: h.patients?.email || h.guest_email || null,
          patientPhone: h.patients?.phone || h.guest_phone || null,
          items: servicesByAppt.get(h.id) || [],
        }));
        const origin = siteOrigin({
          headers: (event && event.headers) || {},
        });
        const sent = await sendOwnerExpiredHoldsDigest({
          holds,
          panelUrl: `${origin}/panel/`,
        });
        emailed = sent ? expired.length : 0;
      }
    }
    console.log(
      `booking-sweep: purged ${purged} expired holds, digest emailed for ${emailed}`,
    );
    return { statusCode: 200, body: JSON.stringify({ purged, emailed }) };
  } catch (e) {
    console.error("booking-sweep error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "sweep_failed" }) };
  }
};
