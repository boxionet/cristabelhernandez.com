// Patient-initiated: edit the treatments of an existing cita
// (manage token or owning session). The client sends the FULL desired
// list, so one save can add new services, remove existing ones, and
// change quantities (a replace is a remove + an add in the same save).
// Every change needs the Dra's confirmation, so the cita goes back to
// 'pendiente' and the Dra gets an owner email describing the change.
// POST JSON:
//   { manageToken | appointmentId, items: [{ slug, quantity }] }
const { serviceClient, json, siteOrigin } = require("./_booking/supabase");
const { resolveAppointment, outsideWindow, FINAL_STATUSES } = require("./_booking/manage");
const { sendOwnerServicesChangeAlert } = require("./_booking/email");
const { formatDateEs, formatTime12h, timeToMinutes, weekdayOf } = require("./_booking/time");
const { checkRateLimit, rateLimited } = require("./_booking/rateLimit");

const MAX_QTY = 5; // same cap as the Panel services editor
const MAX_ITEMS = 10; // same cap as create_booking

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
      items.length > MAX_ITEMS ||
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
    // confirmada), and only then can treatments be edited. Letting an
    // edit land on a hold would skip the email verification.
    if (appointment.status === "por_confirmar")
      return json(409, { error: "unverified_hold" });
    if (outsideWindow(appointment))
      return json(403, { error: "outside_window" });
    // A cita already marked paid must not silently change what is
    // owed: the patient contacts the clinic and staff handle it.
    if (appointment.payment_status === "pagado")
      return json(409, { error: "paid_cita" });

    const [{ data: existingItems }, { data: catalog }, { data: schedule }, { data: exception }] =
      await Promise.all([
        supabase
          .from("appointment_services")
          .select("*")
          .eq("appointment_id", appointment.id),
        supabase.from("services").select("*"),
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

    const existing = existingItems || [];
    const bySlug = new Map((catalog || []).map((s) => [s.slug, s]));
    const existingById = new Map(existing.map((it) => [it.service_id, it]));
    const lines = [];
    for (const it of items) {
      const service = bySlug.get(it.slug);
      // Every line must resolve to a catalog row (durations and
      // prices always come from the catalog). A service NEW to the
      // cita must be active; one already on the cita may stay even
      // if it has since been deactivated — same rule as the Panel
      // editor, which seeds lines regardless of active.
      if (!service || (!service.active && !existingById.has(service.id)))
        return json(400, { error: "invalid_items" });
      lines.push({ service, quantity: it.quantity });
    }

    // No-op guard: the submitted list must differ from the current
    // one (same services, same quantities = nothing to confirm).
    const same =
      lines.length === existing.length &&
      lines.every((l) => {
        const old = existingById.get(l.service.id);
        return old && old.quantity === l.quantity;
      });
    if (same) return json(400, { error: "no_changes" });

    // Totals from the catalog, never from the client — the same
    // recompute as the Panel editor: the whole list re-prices at the
    // current catalog, and a promo keeps its stored percent
    // re-applied to the new subtotal. The patient preview shows
    // exactly these numbers before saving.
    const subtotal = lines.reduce(
      (sum, { service, quantity }) => sum + service.price * quantity,
      0,
    );
    const duration = lines.reduce(
      (sum, { service, quantity }) => sum + service.duration_minutes * quantity,
      0,
    );
    const discount =
      appointment.promo_code && appointment.discount_percent
        ? Math.round((subtotal * appointment.discount_percent) / 100)
        : 0;
    const total = subtotal - discount;
    const estimate = lines.some(
      (l) => l.service.price_from || l.service.price_note !== null,
    );

    // Fit-before-close: the cita (possibly longer now) must still end
    // by closing time, using the same schedule/exception resolution
    // as the availability engine.
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
    // The appointment row updates FIRST so the exclusion constraint /
    // trigger re-validates the new time range — on a conflict nothing
    // else is touched.
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

    // Replace the line items. If the delete or the insert fails, the
    // original appointment row AND the original items are restored so
    // the cita is never left half-edited.
    const newRows = lines.map(({ service, quantity }) => ({
      appointment_id: appointment.id,
      service_id: service.id,
      service_name: service.name,
      unit_price: service.price,
      quantity,
      price_from: service.price_from,
      price_note: service.price_note,
    }));
    const { error: delErr } = await supabase
      .from("appointment_services")
      .delete()
      .eq("appointment_id", appointment.id);
    const { error: insErr } = delErr
      ? { error: delErr }
      : await supabase.from("appointment_services").insert(newRows);
    if (insErr) {
      console.error("booking-update-services items replace failed, restoring", insErr);
      await supabase.from("appointments").update(original).eq("id", appointment.id);
      await supabase.from("appointment_services").delete().eq("appointment_id", appointment.id);
      if (existing.length > 0) {
        await supabase.from("appointment_services").insert(
          existing.map((it) => ({
            appointment_id: appointment.id,
            service_id: it.service_id,
            service_name: it.service_name,
            unit_price: it.unit_price,
            quantity: it.quantity,
            price_from: it.price_from,
            price_note: it.price_note,
          })),
        );
      }
      return json(500, { error: "services_change_failed" });
    }

    // Diff for the Dra's email: what was added, removed, or had its
    // quantity changed, against the list before this edit.
    const newById = new Map(lines.map((l) => [l.service.id, l]));
    const changes = {
      added: lines
        .filter((l) => !existingById.has(l.service.id))
        .map(({ service, quantity }) => ({
          name: service.name,
          quantity,
          unitPrice: service.price,
          priceFrom: service.price_from,
          priceNote: service.price_note,
        })),
      removed: existing
        .filter((it) => !newById.has(it.service_id))
        .map((it) => ({ name: it.service_name, quantity: it.quantity })),
      quantityChanged: lines
        .filter((l) => {
          const old = existingById.get(l.service.id);
          return old && old.quantity !== l.quantity;
        })
        .map((l) => ({
          name: l.service.name,
          oldQuantity: existingById.get(l.service.id).quantity,
          newQuantity: l.quantity,
        })),
    };

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
      changes,
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
