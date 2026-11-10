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
async function sendNewBookingEmails({ appointment, items, confirmUrl, portalUrl }) {
  const resend = resendClient();
  const isGuest = appointment.status === "por_confirmar";
  const patientEmail = appointment.guest_email || null;
  const when = `${formatDateEs(appointment.date)} a las ${formatTime12h(appointment.start_time.slice(0, 5))}`;
  const totalLabel = appointment.total_is_estimate ? "Total estimado" : "Total";
  const results = { owner: false, patient: false };

  // --- Clinic notification ---
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: OWNER_EMAIL,
      reply_to: patientEmail || OWNER_EMAIL,
      subject: `${isGuest ? "Nueva cita POR CONFIRMAR" : "Nueva cita"} — ${appointment.reference_code}`,
      text: [
        `Nueva cita desde la web (${isGuest ? "por confirmar — la paciente aún no confirma su correo" : "paciente verificada"}).`,
        ``,
        `Referencia: ${appointment.reference_code}`,
        `Fecha: ${when}`,
        `Servicios:`,
        itemsListText(items),
        `${totalLabel}: ${formatPrice(appointment.total_price)} (a pagar en el centro, efectivo)`,
        ``,
        `Paciente: ${appointment.guest_name || "(ver en el Panel)"}`,
        patientEmail ? `Correo: ${patientEmail}` : "",
        appointment.guest_phone ? `Teléfono: ${appointment.guest_phone}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    results.owner = true;
  } catch (e) {
    console.error("owner email failed", e);
  }

  // --- Patient email ---
  if (patientEmail) {
    try {
      const summary = `Cita — ${CLINIC_NAME}`;
      const ics = buildIcs({ appointment, summary });
      const gcal = googleCalendarUrl({ appointment, summary });
      const confirmBlock = isGuest
        ? `\nIMPORTANTE: tu cita está apartada pero aún NO está confirmada.\nConfírmala aquí antes de que expire el plazo: ${confirmUrl}\nSi no la confirmas, el espacio se libera automáticamente.\n`
        : "";
      const { data } = await resend.emails.send({
        from: FROM_EMAIL,
        to: patientEmail,
        reply_to: OWNER_EMAIL,
        subject: isGuest
          ? `Confirma tu cita — ${appointment.reference_code}`
          : `Tu cita está registrada — ${appointment.reference_code}`,
        text: [
          `Hola,`,
          ``,
          isGuest
            ? `Recibimos tu solicitud de cita en ${CLINIC_NAME}.`
            : `Tu cita en ${CLINIC_NAME} está registrada.`,
          ``,
          `Referencia: ${appointment.reference_code}`,
          `Fecha: ${when}`,
          `Servicios:`,
          itemsListText(items),
          `${totalLabel}: ${formatPrice(appointment.total_price)}`,
          `A pagar en el centro: ${formatPrice(appointment.total_price)} (efectivo)`,
          confirmBlock,
          `Agregar a tu calendario: ${gcal}`,
          `También adjuntamos un archivo .ics para Apple Calendario, Outlook, etc.`,
          ``,
          `Puedes ver y administrar tus citas en: ${portalUrl}`,
          `Si necesitas cambiar o cancelar, hazlo desde tu cuenta o responde a este correo.`,
        ].join("\n"),
        attachments: [
          {
            filename: `cita-${appointment.reference_code}.ics`,
            content: Buffer.from(ics).toString("base64"),
          },
        ],
      });
      results.patient = Boolean(data);
    } catch (e) {
      console.error("patient email failed", e);
    }
  }
  return results;
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
  sendSimpleEmail,
};
