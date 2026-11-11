// Scheduled: 24-hour appointment reminders (plan §5 notifications).
// Runs hourly; selects confirmed citas starting 23–25 hours from now
// that have not been reminded yet, emails the patient (with the cash
// total due at the centro), and stamps reminder_sent_at so each cita
// is reminded exactly once. Manual POSTs also run it (used in tests).
const { serviceClient, siteOrigin } = require("./_booking/supabase");
const { sendReminderEmail } = require("./_booking/email");

exports.config = { schedule: "0 * * * *" };

exports.handler = async (event) => {
  try {
    const supabase = serviceClient();
    const now = Date.now();
    const from = new Date(now + 23 * 60 * 60 * 1000).toISOString();
    const to = new Date(now + 25 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("appointments")
      .select("*, appointment_services(*), patients(email)")
      .in("status", ["pendiente", "confirmada"])
      .is("reminder_sent_at", null)
      .gte("starts_at", from)
      .lte("starts_at", to);
    if (error) throw error;

    const portalUrl = `${siteOrigin(event)}/mi-cuenta/`;
    let sent = 0;
    for (const appt of rows || []) {
      const email = (appt.patients && appt.patients.email) || appt.guest_email;
      if (!email) continue;
      const ok = await sendReminderEmail({
        appointment: appt,
        items: appt.appointment_services || [],
        portalUrl,
        to: email,
      });
      if (ok) {
        await supabase
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", appt.id);
        sent++;
      }
    }
    console.log(`booking-reminders: checked ${rows ? rows.length : 0}, sent ${sent}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ checked: rows ? rows.length : 0, sent }),
    };
  } catch (e) {
    console.error("booking-reminders error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "reminders_failed" }) };
  }
};
