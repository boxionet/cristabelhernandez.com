// Booking emails via Resend — same sender/recipients as the existing
// send-booking-email.js so the clinic's mail setup stays consistent.
const { Resend } = require("resend");
const { formatDateEs, formatTime12h, timeToMinutes, minutesToTime } = require("./time");

const OWNER_EMAIL = "cristabel@cristabelhernandez.com";
const FROM_EMAIL = "cristabel@mail.cristabelhernandez.com";
const CLINIC_NAME = "Centro Estético Dra. Cristabel Hernández";
const CLINIC_ADDRESS = "Calle Beller No. 129, Plaza Metropolis 2do Nivel, Puerto Plata";

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

function itemsListHtml(items) {
  return items
    .map(
      (i) =>
        `<li>${i.service_name}${i.quantity > 1 ? ` × ${i.quantity}` : ""} — ${formatServicePrice(i)}</li>`,
    )
    .join("");
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

// Sends the pair of emails for a new booking. Never throws: a failed
// email must not fail a booking that already exists in the database.
//
// Approval model: nothing sent before approval carries a calendar
// invite — the patient must not treat a pending request as booked.
// The approval email (sendApprovalEmail) is the one with the .ics and
// the Google Calendar link. Verified bookings have no guest_email, so
// today the patient email below only fires for guest holds; verified
// patients learn their request is pending from the confirmation page
// and from the approval email.
async function sendNewBookingEmails({ appointment, items, confirmUrl, portalUrl, verifiedName, verifiedEmail }) {
  const resend = resendClient();
  const isGuest = appointment.status === "por_confirmar";
  const patientEmail = appointment.guest_email || null;
  const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
  const totalLabel = appointment.total_is_estimate ? "Total estimado" : "Total";
  const results = { owner: false, patient: false };

  // --- Clinic notification ---
  try {
    const ownerEmail = patientEmail || verifiedEmail || OWNER_EMAIL;
    await resend.emails.send({
      from: FROM_EMAIL,
      to: OWNER_EMAIL,
      reply_to: ownerEmail,
      subject: `${isGuest ? "Nueva cita POR CONFIRMAR" : "Nueva cita por aprobar"} — ${appointment.reference_code}`,
      text: [
        isGuest
          ? "Nueva cita desde la web (por confirmar — la paciente aún no confirma su correo)."
          : "Nueva cita desde la web (paciente verificada — pendiente de aprobación en el Panel).",
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
      ]
        .filter(Boolean)
        .join("\n"),
    });
    results.owner = true;
  } catch (e) {
    console.error("owner email failed", e);
  }

  // --- Patient email (guest holds only: verified bookings carry no guest_email) ---
  if (patientEmail) {
    try {
      const confirmBlock = `\nIMPORTANTE: tu cita está apartada pero aún NO está confirmada.\nConfírmala aquí antes de que expire el plazo: ${confirmUrl}\nSi no la confirmas, el espacio se libera automáticamente.\n`;
      const { data } = await resend.emails.send({
        from: FROM_EMAIL,
        to: patientEmail,
        reply_to: OWNER_EMAIL,
        subject: `Confirma tu cita — ${appointment.reference_code}`,
        text: [
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
        ].join("\n"),
      });
      results.patient = Boolean(data);
    } catch (e) {
      console.error("patient email failed", e);
    }
  }
  return results;
}

// The Dra approved a pending request: THIS is the confirmation the
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
      from: FROM_EMAIL,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Tu cita está confirmada — ${appointment.reference_code}`,
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

// The Dra did not approve a pending request: the patient hears it from
// the clinic, with a way to find another date.
async function sendRejectionEmail({ appointment, items, portalUrl, to }) {
  try {
    const resend = resendClient();
    const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Tu solicitud de cita no fue aprobada — ${appointment.reference_code}`,
      text: [
        `Hola,`,
        ``,
        `Lamentamos informarte que tu solicitud de cita en ${CLINIC_NAME} no pudo ser aprobada para la fecha solicitada:`,
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
      from: FROM_EMAIL,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Confirma tu cita — ${appointment.reference_code}`,
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
      from: FROM_EMAIL,
      to,
      reply_to: OWNER_EMAIL,
      subject: `Recordatorio de tu cita — ${appointment.reference_code}`,
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

async function sendSimpleEmail({ to, subject, text }) {
  try {
    const resend = resendClient();
    await resend.emails.send({ from: FROM_EMAIL, to, reply_to: OWNER_EMAIL, subject, text });
    return true;
  } catch (e) {
    console.error("email failed", e);
    return false;
  }
}

module.exports = {
  OWNER_EMAIL,
  FROM_EMAIL,
  formatPrice,
  sendNewBookingEmails,
  sendApprovalEmail,
  sendRejectionEmail,
  sendConfirmationRequestEmail,
  sendReminderEmail,
  sendSimpleEmail,
};
