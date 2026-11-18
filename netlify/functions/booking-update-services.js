// Patient-initiated: add treatments to an existing cita (manage
// token or owning session). Add-only: the patient can add NEW
// services, never remove or change the ones already on the cita.
// Every change needs the Dra's confirmation, so the cita goes back to
// 'pendiente' and the Dra gets an owner email. POST JSON:
//   { manageToken | appointmentId, items: [{ slug, quantity }] }
const { serviceClient, json, siteOrigin } = require("./_booking/supabase");
const { resolveAppointment, outsideWindow, FINAL_STATUSES } = require("./_booking/manage");
const { sendOwnerServicesChangeAlert } = require("./_booking/email");
const { formatDateEs, formatTime12h, timeToMinutes, weekdayOf } = require("./_booking/time");
const { checkRateLimit, rateLimited } = require("./_booking/rateLimit");

const MAX_QTY = 5; // same cap as the Panel services editor
const MAX_ITEMS_TOTAL = 10; // same cap as create_booking

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
  const throttle = await checkRateLimit(event, "booking-update-services", 10);
  if (!throttle.allowed) return rateLimited(throttle.resetAfter);
  try {
    const body = JSON.parse(event.body || "{}");
    const items = body.items;
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > MAX_ITEMS_TOTAL ||
      items.some(
        (it) =>
          !it ||
          typeof it.slug !== "string" ||
          !Number.isInteger(it.quantity) ||
          it.quantity < 1 ||
          it.quantity > MAX_QTY,
      ) ||
      new Set(items.map((it) => it.slug)).size !== items.length
    ) {
      return json(400, { error: "invalid_items" });
    }

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
    // An unverified hold must be verified first: the confirmation
    // click resolves it (web -> pendiente, staff-created ->
    // confirmada), and only then can treatments be added. Letting an
    // edit land on a hold would skip the email verification.
    if (appointment.status === "por_confirmar")
      return json(409, { error: "unverified_hold" });
    if (outsideWindow(appointment))
      return json(403, { error: "outside_window" });
    // A cita already marked paid must not silently grow a balance:
    // the patient contacts the clinic and staff handle it.
    if (appointment.payment_status === "pagado")
      return json(409, { error: "paid_cita" });

    const [{ data: existingItems }, { data: catalog }, { data: schedule }, { data: exception }] =
      await Promise.all([
        supabase
          .from("appointment_services")
          .select("service_id")
          .eq("appointment_id", appointment.id),
        supabase.from("services").select("*").in(
          "slug",
          items.map((it) => it.slug),
        ),
        supabase
          .from("weekly_schedule")
          .select("is_open,open_time,close_time")
          .eq("weekday", weekdayOf(appointment.date))
          .maybeSingle(),
        supabase
          .from("date_exceptions")
          .select("is_closed,open_time,close_time")
          .eq("date", appointment.date)
          .maybeSingle(),
      ]);

    if ((existingItems || []).length + items.length > MAX_ITEMS_TOTAL)
      return json(400, { error: "invalid_items" });
    const bySlug = new Map((catalog || []).map((s) => [s.slug, s]));
    const already = new Set((existingItems || []).map((it) => it.service_id));
    const added = [];
    for (const it of items) {
      const service = bySlug.get(it.slug);
      // Added services must exist, be active, and not already be on
      // the cita (increasing an existing treatment's quantity is a
      // Panel edit, not a patient add).
      if (!service || !service.active || already.has(service.id))
        return json(400, { error: "invalid_items" });
      added.push({ service, quantity: it.quantity });
    }

    // Totals from the catalog, never from the client. The existing
    // subtotal is kept as booked (no re-pricing of what the patient
    // already has); only the additions price at the current catalog.
    // A promo keeps its stored percent, re-applied to the new
    // subtotal — the same snapshot rule as the Panel editor.
    const addedSubtotal = added.reduce(
      (sum, { service, quantity }) => sum + service.price * quantity,
      0,
    );
    const addedDuration = added.reduce(
      (sum, { service, quantity }) => sum + service.duration_minutes * quantity,
      0,
    );
    const subtotal = (appointment.subtotal_price ?? appointment.total_price) + addedSubtotal;
    const discount =
      appointment.promo_code && appointment.discount_percent
        ? Math.round((subtotal * appointment.discount_percent) / 100)
        : 0;
    const total = subtotal - discount;
    const duration = appointment.duration_minutes + addedDuration;
    const estimate =
      appointment.total_is_estimate ||
      added.some((a) => a.service.price_from || a.service.price_note !== null);

    // Fit-before-close: the longer cita must still end by closing
    // time, using the same schedule/exception resolution as the
    // availability engine.
    let open = false;
    let closeTime = null;
    if (exception) {
      open = !exception.is_closed;
      closeTime = exception.close_time || schedule?.close_time || null;
    } else if (schedule && schedule.is_open) {
      open = true;
      closeTime = schedule.close_time;
    }
    const startMinutes = timeToMinutes(String(appointment.start_time).slice(0, 5));
    if (!open || !closeTime || startMinutes + duration > timeToMinutes(String(closeTime).slice(0, 5)))
      return json(409, { error: "outside_hours" });

    // Confirmation model: any treatment change voids a confirmation
    // — the cita goes back to 'pendiente' for the Dra to confirm
    // again. Manual override (migration 010): a patient-driven change
    // restores the normal overlap protection, so the flag clears and
    // the trigger validates the new time range.
    const original = {
      duration_minutes: appointment.duration_minutes,
      total_price: appointment.total_price,
      total_is_estimate: appointment.total_is_estimate,
      subtotal_price: appointment.subtotal_price,
      discount_amount: appointment.discount_amount,
      status: appointment.status,
      manual_override: appointment.manual_override,
    };
    const wasConfirmed = appointment.status === "confirmada";
    const { data: updated, error } = await supabase
      .from("appointments")
      .update({
        duration_minutes: duration,
        total_price: total,
        total_is_estimate: estimate,
        subtotal_price: subtotal,
        discount_amount: appointment.promo_code ? discount : null,
        status: "pendiente",
        manual_override: false,
      })
      .eq("id", appointment.id)
      .select()
      .single();
    if (error) {
      if (error.code === "23P01") return json(409, { error: "change_overlap" });
      throw error;
    }

    // Append the new line items. If the insert fails, restore the
    // original appointment row so the totals never disagree with the
    // items on the cita.
    const { error: insErr } = await supabase.from("appointment_services").insert(
      added.map(({ service, quantity }) => ({
        appointment_id: appointment.id,
        service_id: service.id,
        service_name: service.name,
        unit_price: service.price,
        quantity,
        price_from: service.price_from,
        price_note: service.price_note,
      })),
    );
    if (insErr) {
      console.error("booking-update-services items insert failed, restoring", insErr);
      await supabase.from("appointments").update(original).eq("id", appointment.id);
      return json(500, { error: "services_change_failed" });
    }

    let patient = null;
    if (appointment.patient_id) {
      const { data } = await supabase
        .from("patients")
        .select("full_name,email,phone")
        .eq("id", appointment.patient_id)
        .maybeSingle();
      patient = data;
    }
    const when = `${formatDateEs(updated.date)} a las ${formatTime12h(String(updated.start_time).slice(0, 5))}`;
    await sendOwnerServicesChangeAlert({
      appointment: updated,
      added: added.map(({ service, quantity }) => ({
        name: service.name,
        quantity,
        unitPrice: service.price,
        priceFrom: service.price_from,
        priceNote: service.price_note,
      })),
      patientName: patient?.full_name || appointment.guest_name || null,
      patientEmail: patient?.email || appointment.guest_email || null,
      patientPhone: patient?.phone || appointment.guest_phone || null,
      when,
      wasConfirmed,
      panelUrl: `${siteOrigin(event)}/panel/`,
    });

    return json(200, {
      referenceCode: updated.reference_code,
      status: updated.status,
      totalPrice: updated.total_price,
      durationMinutes: updated.duration_minutes,
    });
  } catch (e) {
    console.error("booking-update-services error", e);
    return json(500, { error: "services_change_failed" });
  }
};
