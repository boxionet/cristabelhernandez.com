// Server-driven confirmation lookup (Phase 3: React booking
// migration). GET ?ref=CH-XXXXXX returns the appointment summary the
// confirmation page renders — no localStorage, no session needed.
//
// The reference code is the capability: it only ever travels in the
// patient's own email and in the redirect that follows a validated
// link click, and the 6-character code space is not enumerable at
// any practical rate. The response deliberately carries NO contact
// details (no email, no phone) — name, date, services and total
// only. Por-confirmar holds report the guest name until the patient
// record is linked at verification.
const { serviceClient, json } = require("./_booking/supabase");

exports.handler = async (event) => {
  try {
    const ref = (event.queryStringParameters || {}).ref;
    if (!ref || !/^CH-[A-Z0-9]{6}$/.test(ref)) {
      return json(400, { error: "bad_ref" });
    }
    const supabase = serviceClient();
    const { data: appt, error } = await supabase
      .from("appointments")
      .select(
        "id,reference_code,status,date,start_time,duration_minutes,total_price,total_is_estimate,patient_id,guest_name,confirmation_expires_at",
      )
      .eq("reference_code", ref)
      .maybeSingle();
    if (error) throw error;
    if (!appt) return json(404, { error: "not_found" });

    let patientName = appt.guest_name || null;
    if (appt.patient_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("full_name")
        .eq("id", appt.patient_id)
        .maybeSingle();
      if (patient && patient.full_name) patientName = patient.full_name;
    }

    const { data: items } = await supabase
      .from("appointment_services")
      .select("service_name,unit_price,quantity,price_from,price_note")
      .eq("appointment_id", appt.id)
      .order("service_name", { ascending: true });

    return json(200, {
      referenceCode: appt.reference_code,
      status: appt.status,
      date: appt.date,
      startTime: String(appt.start_time).slice(0, 5),
      durationMinutes: appt.duration_minutes,
      totalPrice: appt.total_price,
      totalIsEstimate: appt.total_is_estimate,
      confirmationExpiresAt: appt.confirmation_expires_at,
      patientName,
      items: (items || []).map((i) => ({
        service_name: i.service_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        price_from: i.price_from,
        price_note: i.price_note,
      })),
    });
  } catch (e) {
    console.error("booking-lookup error", e);
    return json(500, { error: "lookup_failed" });
  }
};
