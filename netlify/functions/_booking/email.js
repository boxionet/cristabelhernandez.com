// Booking emails via Resend — same sender/recipients as the existing
// send-booking-email.js so the clinic's mail setup stays consistent.
//
// DESIGN (v2, Nov 2026): simple, Supabase-style. White background, the
// clinic logo icon (the favicon mark, hosted on the live site) in a
// bordered rounded square, bold headline, plain body, one full-width
// button, gray footer with the address. Every send carries BOTH an
// html part (buttons, no visible raw URLs) and a text part (the full
// URLs, for clients that strip HTML). The sender shows the clinic
// name, not a bare address.
//
// USER-FACING LANGUAGE: the Dra "confirms" a request; a request she
// declines is "not confirmed" — never "approved / not approved".
const { Resend } = require("resend");
const { formatDateEs, formatTime12h, timeToMinutes, minutesToTime } = require("./time");

const OWNER_EMAIL = "cristabel@cristabelhernandez.com";
const FROM_EMAIL = "cristabel@mail.cristabelhernandez.com";
const CLINIC_NAME = "Centro Estético Dra. Cristabel Hernández";
const FROM = `${CLINIC_NAME} <${FROM_EMAIL}>`;
const CLINIC_ADDRESS = "Calle Beller No. 129, Plaza Metropolis 2do Nivel, Puerto Plata";
const CLINIC_PHONE = "(829) 316-3313";
const MAP_LINK =
  "https://www.google.com/maps/place/Dra.+Cristabel+Hern%C3%A1ndez+-+Medicina+Est%C3%A9tica,+regenerativa+y+antienvejecimiento/@19.7948341,-70.6881958,678m/data=!3m1!1e3!4m6!3m5!1s0x8eb1ef32ad8b0575:0x38e44379a6429fa7!8m2!3d19.7946178!4d-70.6871262!16s%2Fg%2F11zgy_vn4p?entry=ttu&g_ep=EgoyMDI2MTEwMy4wIKXMDSoASAFQAw%3D%3D";
// The favicon mark, already live on production — absolute URL because
// email clients load images outside the site.
const ICON_URL = "https://cristabelhernandez.com/assets/favicons/apple-touch-icon.png";

const SAGE_DARK = "#3e4c35";
const INK = "#111827";
const BODY = "#1f2937";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const RULE = "#e5e7eb";
const LINK = "#2563eb";
const SANS = "Arial,Helvetica,sans-serif";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailParagraph(text) {
  return `<p style="margin:0 0 14px;">${text}</p>`;
}

function emailLink(href, text) {
  return `<a href="${href}" style="color:${LINK};">${text}</a>`;
}

function emailButton(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;"><tr><td align="center" bgcolor="${SAGE_DARK}" style="border-radius:8px;background:${SAGE_DARK};"><a href="${href}" style="display:block;padding:15px 20px;font-family:${SANS};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a></td></tr></table>`;
}

function emailDetails(rows) {
  const trs = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;font-family:${SANS};font-size:14px;color:${MUTED};vertical-align:top;width:150px;">${label}</td><td style="padding:6px 0;font-family:${SANS};font-size:16px;color:${BODY};line-height:1.5;">${value}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};margin:24px 0;padding:6px 0;"><tr><td style="padding:10px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${trs}</table></td></tr></table>`;
}

function emailShell({ preheader, title, body, staff }) {
  const footerNote = staff
    ? "Aviso automático del sistema de reservas."
    : "Responde a este correo si necesitas ayuda.";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;">${preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;margin:0;padding:0;"><tr><td align="center" style="padding:0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;">
<tr><td style="padding:40px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="64"><tr><td style="border:1px solid ${RULE};border-radius:12px;padding:9px;"><img src="${ICON_URL}" width="44" height="44" alt="${CLINIC_NAME}" style="display:block;border:0;width:44px;height:44px;font-size:11px;line-height:1.2;color:${MUTED};"></td></tr></table>
<h1 style="font-family:${SANS};font-size:30px;line-height:1.25;font-weight:bold;color:${INK};margin:28px 0 16px;">${title}</h1>
<div style="font-family:${SANS};font-size:16px;line-height:1.65;color:${BODY};">${body}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${RULE};margin-top:40px;padding-top:20px;font-family:${SANS};font-size:13px;line-height:1.7;color:${FAINT};">
${CLINIC_NAME}, <a href="${MAP_LINK}" style="color:${LINK};">Calle Beller No. 129, Plaza Metropolis 2do Nivel</a>, Puerto Plata, República Dominicana &middot; ${CLINIC_PHONE}<br>${footerNote}
</td></tr></table>
<div style="height:40px;line-height:40px;">&nbsp;</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function formatPrice(amount) {
  return `RD$ ${Math.round(amount).toLocaleString("en-US")}`;
}

function formatServicePrice(item) {
  let text = formatPrice(item.unit_price);
  if (item.price_from) text = `Desde ${text}`;
  if (item.price_note === "c/ampolla") text += " c/ampolla";
  else if (item.price_note) text += ` (${item.price_note})`;
  return text;
}

function itemsListCell(items) {
  return items
    .map(
      (i) =>
        `${escapeHtml(i.service_name)}${i.quantity > 1 ? ` × ${i.quantity}` : ""} — ${formatServicePrice(i)}`,
    )
    .join("<br>");
}

function itemsListText(items) {
  return items
    .map(
      (i) =>
        `- ${i.service_name}${i.quantity > 1 ? ` x${i.quantity}` : ""}: ${formatServicePrice(i)}`,
    )
    .join("\n");
}

// UTC timestamps for calendar files: Santo Domingo is UTC-4 year-round.
function toUtcStamp(dateISO, hhmm) {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const mins = timeToMinutes(hhmm) + 4 * 60;
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, mins));
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}00Z`;
}

function buildIcs({ appointment, summary }) {
  const start = toUtcStamp(appointment.date, appointment.start_time.slice(0, 5));
  const endMins = timeToMinutes(appointment.start_time.slice(0, 5)) + appointment.duration_minutes;
  const end = toUtcStamp(appointment.date, minutesToTime(endMins));
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Boxionet//Cristabel Booking//ES",
    "BEGIN:VEVENT",
    `UID:${appointment.reference_code}@cristabelhernandez.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `LOCATION:${CLINIC_ADDRESS}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function googleCalendarUrl({ appointment, summary }) {
  const start = toUtcStamp(appointment.date, appointment.start_time.slice(0, 5));
  const endMins = timeToMinutes(appointment.start_time.slice(0, 5)) + appointment.duration_minutes;
  const end = toUtcStamp(appointment.date, minutesToTime(endMins));
  const text = encodeURIComponent(summary);
  const dates = `${start}/${end}`;
  const location = encodeURIComponent(CLINIC_ADDRESS);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&location=${location}`;
}

function resendClient() {
  if (!process.env.RESEND_API_KEY) throw new Error("missing_resend_env");
  return new Resend(process.env.RESEND_API_KEY);
}

function appointmentDetailsRows({ appointment, items, when, totalLabel, extra }) {
  return [
    ["Referencia", escapeHtml(appointment.reference_code)],
    ["Fecha", when],
    ["Servicios", itemsListCell(items)],
    [totalLabel, formatPrice(appointment.total_price)],
    ["A pagar en el centro", `${formatPrice(appointment.total_price)} (efectivo)`],
    ...(extra || []),
  ];
}

// Sends the pair of emails for a new booking. Never throws: a failed
// email must not fail a booking that already exists in the database.
//
// Confirmation model: nothing sent before confirmation carries a
// calendar invite — the patient must not treat a pending request as
// booked. The confirmation email (sendApprovalEmail) is the one with
// the .ics and the Google Calendar link. Verified bookings have no
// guest_email, so today the patient email below only fires for guest
// holds; verified patients learn their request is pending from the
// confirmation page and from the confirmation email.
async function sendNewBookingEmails({ appointment, items, confirmUrl, portalUrl, panelUrl, verifiedName, verifiedEmail }) {
  const resend = resendClient();
  const isGuest = appointment.status === "por_confirmar";
  const patientEmail = appointment.guest_email || null;
  const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
  const totalLabel = appointment.total_is_estimate ? "Total estimado" : "Total";
  const results = { owner: false, patient: false };

  // --- Clinic notification ---
  try {
    const ownerEmail = patientEmail || verifiedEmail || OWNER_EMAIL;
    const intro = isGuest
      ? "Nueva cita desde la web (por confirmar — la paciente aún no confirma su correo)."
      : "Nueva cita desde la web (paciente verificada — pendiente de confirmación en el Panel).";
    const patientRows = [
      ["Paciente", escapeHtml(appointment.guest_name || verifiedName || "(ver en el Panel)")],
      ...(ownerEmail !== OWNER_EMAIL ? [["Correo", escapeHtml(ownerEmail)]] : []),
      ...(appointment.guest_phone ? [["Teléfono", escapeHtml(appointment.guest_phone)]] : []),
    ];
    const ownerText = [
      intro,
      ``,
      `Referencia: ${appointment.reference_code}`,
      `Fecha: ${when}`,
      `Servicios:`,
      itemsListText(items),
      `${totalLabel}: ${formatPrice(appointment.total_price)} (a pagar en el centro, efectivo)`,
      ``,
      `Paciente: ${appointment.guest_name || verifiedName || "(ver en el Panel)"}`,
      ownerEmail !== OWNER_EMAIL ? `Correo: ${ownerEmail}` : "",
      appointment.guest_phone ? `Teléfono: ${appointment.guest_phone}` : "",
      ``,
      `Ver en el Panel: ${panelUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
    await resend.emails.send({
      from: FROM,
      to: OWNER_EMAIL,
      reply_to: ownerEmail,
      subject: `Nueva cita por confirmar — ${appointment.reference_code}`,
      html: emailShell({
        preheader: "Nueva cita desde la web, pendiente de confirmación en el Panel.",
        title: "Nueva cita por confirmar",
        staff: true,
        body:
          emailParagraph(intro) +
          emailDetails([...appointmentDetailsRows({ appointment, items, when, totalLabel }), ...patientRows]) +
          emailButton("Ver en el Panel", panelUrl),
      }),
      text: ownerText,
    });
    results.owner = true;
  } catch (e) {
    console.error("owner email failed", e);
  }

  // --- Patient email (guest holds only: verified bookings carry no guest_email) ---
  if (patientEmail) {
    try {
      const confirmBlock = `\nIMPORTANTE: tu cita está apartada pero aún NO está confirmada.\nConfírmala aquí antes de que expire el plazo: ${confirmUrl}\nSi no la confirmas, el espacio se libera automáticamente.\n`;
      const patientText = [
        `Hola,`,
        ``,
        `Recibimos tu solicitud de cita en ${CLINIC_NAME}.`,
        ``,
        `Referencia: ${appointment.reference_code}`,
        `Fecha: ${when}`,
        `Servicios:`,
        itemsListText(items),
        `${totalLabel}: ${formatPrice(appointment.total_price)}`,
        `A pagar en el centro: ${formatPrice(appointment.total_price)} (efectivo)`,
        confirmBlock,
        `Puedes ver y administrar tus citas en: ${portalUrl}`,
        `Si necesitas cambiar o cancelar, hazlo desde tu cuenta o responde a este correo.`,
      ].join("\n");
      const { data } = await resend.emails.send({
        from: FROM,
        to: patientEmail,
        reply_to: OWNER_EMAIL,
        subject: `Confirma tu cita — ${appointment.reference_code}`,
        html: emailShell({
          preheader: "Confirma tu cita con un toque — el espacio queda apartado hasta que expire el plazo.",
          title: "Confirma tu cita",
          body:
            emailParagraph("Hola,") +
            emailParagraph(`Recibimos tu solicitud de cita en el ${CLINIC_NAME}.`) +
            emailParagraph(
              "<strong>Tu cita está apartada, pero aún NO está confirmada.</strong> Confírmala antes de que expire el plazo; si no la confirmas, el espacio se libera automáticamente.",
            ) +
            emailButton("Confirmar mi cita", confirmUrl) +
            emailDetails(appointmentDetailsRows({ appointment, items, when, totalLabel })) +
            emailParagraph(
              `Puedes ver y administrar tus citas en ${emailLink(portalUrl, "Mi Cuenta")}. Si necesitas cambiar o cancelar, hazlo desde tu cuenta o responde a este correo.`,
            ),
        }),
        text: patientText,
      });
      results.patient = Boolean(data);
    } catch (e) {
      console.error("patient email failed", e);
    }
  }
  return results;
}

// The Dra confirmed a pending request: THIS is the confirmation the
// patient receives, with the calendar invite attached.
async function sendApprovalEmail({ appointment, items, portalUrl, to }) {
  try {
    const resend = resendClient();
    const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
    const totalLabel = appointment.total_is_estimate ? "Total estimado" : "Total";
    const summary = `Cita — ${CLINIC_NAME}`;
    const ics = buildIcs({ appointment, summary });
    const gcal = googleCalendarUrl({ appointment, summary });
    await resend.emails.send({
      from: FROM,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Tu cita está confirmada — ${appointment.reference_code}`,
      html: emailShell({
        preheader: "¡Tu cita está confirmada! Te esperamos.",
        title: "¡Tu cita está confirmada!",
        body:
          emailParagraph("Hola,") +
          emailParagraph(`¡Tu cita en el ${CLINIC_NAME} está confirmada! Te esperamos.`) +
          emailDetails(appointmentDetailsRows({ appointment, items, when, totalLabel })) +
          emailButton("Agregar a Google Calendar", gcal) +
          emailParagraph("También adjuntamos un archivo .ics para Apple Calendario, Outlook y otros calendarios.") +
          emailParagraph(
            `Puedes ver y administrar tus citas en ${emailLink(portalUrl, "Mi Cuenta")}. Si necesitas cambiar o cancelar, hazlo desde tu cuenta hasta 24 horas antes, o responde a este correo.`,
          ),
      }),
      text: [
        `Hola,`,
        ``,
        `¡Tu cita en ${CLINIC_NAME} está confirmada! Te esperamos.`,
        ``,
        `Referencia: ${appointment.reference_code}`,
        `Fecha: ${when}`,
        `Servicios:`,
        itemsListText(items),
        `${totalLabel}: ${formatPrice(appointment.total_price)}`,
        `A pagar en el centro: ${formatPrice(appointment.total_price)} (efectivo)`,
        ``,
        `Agregar a tu calendario: ${gcal}`,
        `También adjuntamos un archivo .ics para Apple Calendario, Outlook, etc.`,
        ``,
        `Puedes ver y administrar tus citas en: ${portalUrl}`,
        `Si necesitas cambiar o cancelar, hazlo desde tu cuenta hasta 24 horas antes, o responde a este correo.`,
      ].join("\n"),
      attachments: [
        {
          filename: `cita-${appointment.reference_code}.ics`,
          content: Buffer.from(ics).toString("base64"),
        },
      ],
    });
    return true;
  } catch (e) {
    console.error("approval email failed", e);
    return false;
  }
}

// The Dra did not confirm a pending request: the patient hears it from
// the clinic, with a way to find another date.
async function sendRejectionEmail({ appointment, items, portalUrl, to }) {
  try {
    const resend = resendClient();
    const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
    await resend.emails.send({
      from: FROM,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Tu solicitud de cita no fue confirmada — ${appointment.reference_code}`,
      html: emailShell({
        preheader: "No pudimos confirmar tu cita para la fecha solicitada.",
        title: "No pudimos confirmar tu cita",
        body:
          emailParagraph("Hola,") +
          emailParagraph(
            `Lamentamos informarte que tu solicitud de cita en el ${CLINIC_NAME} no pudo ser confirmada para la fecha solicitada:`,
          ) +
          emailDetails([
            ["Referencia", escapeHtml(appointment.reference_code)],
            ["Fecha solicitada", when],
            ["Servicios", itemsListCell(items)],
          ]) +
          emailButton("Reservar otra fecha", portalUrl) +
          emailParagraph(`O llámanos al ${CLINIC_PHONE} y con gusto buscamos otro horario para ti.`),
      }),
      text: [
        `Hola,`,
        ``,
        `Lamentamos informarte que tu solicitud de cita en ${CLINIC_NAME} no pudo ser confirmada para la fecha solicitada:`,
        ``,
        `Referencia: ${appointment.reference_code}`,
        `Fecha solicitada: ${when}`,
        `Servicios:`,
        itemsListText(items),
        ``,
        `Puedes reservar otra fecha desde ${portalUrl} o llamarnos al (829) 316-3313 y con gusto buscamos otro horario para ti.`,
      ].join("\n"),
    });
    return true;
  } catch (e) {
    console.error("rejection email failed", e);
    return false;
  }
}

// A staff-created booking with an email: the patient confirms through
// the same tokenized link as a guest hold. No calendar invite — the
// booking is not confirmed until she clicks.
async function sendConfirmationRequestEmail({ appointment, items, confirmUrl, portalUrl, to }) {
  try {
    const resend = resendClient();
    const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
    const totalLabel = appointment.total_is_estimate ? "Total estimado" : "Total";
    await resend.emails.send({
      from: FROM,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Confirma tu cita — ${appointment.reference_code}`,
      html: emailShell({
        preheader: "Registramos una cita para ti — confírmala con un toque.",
        title: "Confirma tu cita",
        body:
          emailParagraph("Hola,") +
          emailParagraph(
            `El ${CLINIC_NAME} registró una cita para ti. Por favor confírmala antes de que expire el plazo.`,
          ) +
          emailParagraph("Si no la confirmas, el espacio se libera automáticamente.") +
          emailButton("Confirmar mi cita", confirmUrl) +
          emailDetails(appointmentDetailsRows({ appointment, items, when, totalLabel })) +
          emailParagraph(
            `Puedes ver y administrar tus citas en ${emailLink(portalUrl, "Mi Cuenta")}.`,
          ),
      }),
      text: [
        `Hola,`,
        ``,
        `${CLINIC_NAME} registró una cita para ti. Por favor confírmala en este enlace antes de que expire el plazo:`,
        `${confirmUrl}`,
        `Si no la confirmas, el espacio se libera automáticamente.`,
        ``,
        `Referencia: ${appointment.reference_code}`,
        `Fecha: ${when}`,
        `Servicios:`,
        itemsListText(items),
        `${totalLabel}: ${formatPrice(appointment.total_price)}`,
        `A pagar en el centro: ${formatPrice(appointment.total_price)} (efectivo)`,
        ``,
        `Puedes ver y administrar tus citas en: ${portalUrl}`,
      ].join("\n"),
    });
    return true;
  } catch (e) {
    console.error("confirmation-request email failed", e);
    return false;
  }
}

// 24-hour reminder (plan §5): date/time, the cash total due at the
// centro, and the portal link to manage the cita.
async function sendReminderEmail({ appointment, items, portalUrl, to }) {
  try {
    const resend = resendClient();
    const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
    const totalLabel = appointment.total_is_estimate ? "Total estimado" : "Total";
    await resend.emails.send({
      from: FROM,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Recordatorio de tu cita — ${appointment.reference_code}`,
      html: emailShell({
        preheader: "Te recordamos tu cita y lo que debes pagar en el centro.",
        title: "Te recordamos tu cita",
        body:
          emailParagraph("Hola,") +
          emailParagraph(`Te recordamos tu cita en el ${CLINIC_NAME}:`) +
          emailDetails(appointmentDetailsRows({ appointment, items, when, totalLabel })) +
          emailButton("Ver mi cita", portalUrl) +
          emailParagraph(
            "Si necesitas cambiar o cancelar, hazlo desde tu cuenta. Recuerda que los cambios desde la cuenta están disponibles hasta 24 horas antes; después de eso, llámanos o responde a este correo.",
          ),
      }),
      text: [
        `Hola,`,
        ``,
        `Te recordamos tu cita en ${CLINIC_NAME}:`,
        ``,
        `Referencia: ${appointment.reference_code}`,
        `Fecha: ${when}`,
        `Servicios:`,
        itemsListText(items),
        `${totalLabel}: ${formatPrice(appointment.total_price)}`,
        `A pagar en el centro: ${formatPrice(appointment.total_price)} (efectivo)`,
        ``,
        `Si necesitas cambiar o cancelar, hazlo desde tu cuenta: ${portalUrl}`,
        `Recuerda que los cambios desde la cuenta están disponibles hasta 24 horas antes; después de eso, llámanos o responde a este correo.`,
      ].join("\n"),
    });
    return true;
  } catch (e) {
    console.error("reminder email failed", e);
    return false;
  }
}

// Clinic notification: the patient cancelled from her email link or
// her account. Never throws — see sendNewBookingEmails.
async function sendCancellationNotice({ appointment, when, panelUrl }) {
  try {
    const resend = resendClient();
    const line = `La paciente canceló su cita ${appointment.reference_code} (${when}) desde el enlace de su correo o su cuenta. El espacio quedó libre.`;
    await resend.emails.send({
      from: FROM,
      to: OWNER_EMAIL,
      reply_to: OWNER_EMAIL,
      subject: `Cita cancelada — ${appointment.reference_code}`,
      html: emailShell({
        preheader: "La paciente canceló su cita — el espacio quedó libre.",
        title: "Cita cancelada",
        staff: true,
        body:
          emailParagraph(
            `La paciente canceló su cita <strong>${escapeHtml(appointment.reference_code)}</strong> (${when}) desde el enlace de su correo o su cuenta. El espacio quedó libre.`,
          ) + emailButton("Ver en el Panel", panelUrl),
      }),
      text: `${line}\n\nVer en el Panel: ${panelUrl}`,
    });
    return true;
  } catch (e) {
    console.error("cancellation notice failed", e);
    return false;
  }
}

// Clinic notification: the patient rescheduled. A rescheduled
// confirmed cita drops back to pending and needs confirmation again.
async function sendRescheduleNotice({ appointment, when, wasConfirmed, panelUrl }) {
  try {
    const resend = resendClient();
    const line = wasConfirmed
      ? `La cita ${appointment.reference_code} se reprogramó para el ${when}. Como estaba confirmada, vuelve a pendiente y requiere confirmación en el Panel.`
      : `La cita ${appointment.reference_code} se reprogramó para el ${when}.`;
    await resend.emails.send({
      from: FROM,
      to: OWNER_EMAIL,
      reply_to: OWNER_EMAIL,
      subject: `Cita reprogramada — ${appointment.reference_code}`,
      html: emailShell({
        preheader: wasConfirmed
          ? "La cita se reprogramó y vuelve a pendiente."
          : "La cita se reprogramó.",
        title: "Cita reprogramada",
        staff: true,
        body:
          emailParagraph(
            wasConfirmed
              ? `La cita <strong>${escapeHtml(appointment.reference_code)}</strong> se reprogramó para el ${when}. Como estaba confirmada, vuelve a pendiente y requiere confirmación en el Panel.`
              : `La cita <strong>${escapeHtml(appointment.reference_code)}</strong> se reprogramó para el ${when}.`,
          ) + emailButton("Ver en el Panel", panelUrl),
      }),
      text: `${line}\n\nVer en el Panel: ${panelUrl}`,
    });
    return true;
  } catch (e) {
    console.error("reschedule notice failed", e);
    return false;
  }
}

module.exports = {
  OWNER_EMAIL,
  FROM_EMAIL,
  FROM,
  CLINIC_NAME,
  CLINIC_PHONE,
  formatPrice,
  escapeHtml,
  emailShell,
  emailParagraph,
  emailLink,
  emailButton,
  emailDetails,
  sendNewBookingEmails,
  sendApprovalEmail,
  sendRejectionEmail,
  sendConfirmationRequestEmail,
  sendReminderEmail,
  sendCancellationNotice,
  sendRescheduleNotice,
};
