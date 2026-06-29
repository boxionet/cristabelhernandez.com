const { Resend } = require("resend");

const OWNER_EMAIL = "cristabel@cristabelhernandez.com";
const FROM_EMAIL = "cristabel@mail.cristabelhernandez.com";

// Dominican Republic (Puerto Plata) is UTC-4 all year (no DST)
const CLINIC_UTC_OFFSET_HOURS = -4;

function formatPrice(amount) {
  if (amount === undefined || amount === null) return "RD$ 0";
  return `RD$ ${Math.round(amount).toLocaleString("en-US")}`;
}

function formatDateTime(dateTime) {
  if (!dateTime) return "—";
  if (typeof dateTime === "object" && dateTime.date && dateTime.time) {
    return `${dateTime.date} · ${dateTime.time}`;
  }
  if (typeof dateTime === "string") {
    return dateTime;
  }
  return "—";
}

function buildServicesList(services) {
  const items = Object.values(services || {});
  if (items.length === 0) return "<li>No se seleccionaron servicios</li>";

  return items
    .map((service) => {
      const qty = service.quantity || 1;
      const total = service.price * qty;
      return `<li>${service.name} × ${qty} — ${formatPrice(total)}</li>`;
    })
    .join("");
}

function calculateTotal(services) {
  return Object.values(services || {}).reduce((sum, service) => {
    return sum + service.price * (service.quantity || 1);
  }, 0);
}

const MONTH_MAP = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function parseDateString(dateStr) {
  if (!dateStr) return null;
  let match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (match) {
    return {
      day: match[1].padStart(2, "0"),
      month: MONTH_MAP[match[2].toLowerCase()],
      year: match[3],
    };
  }
  match = dateStr.match(/(\w+)\s+(\d{1,2})/i);
  if (match) {
    return {
      day: match[2].padStart(2, "0"),
      month: MONTH_MAP[match[1].toLowerCase()],
      year: String(new Date().getFullYear()),
    };
  }
  return null;
}

function parseTimeString(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return { hours: String(hours).padStart(2, "0"), minutes };
}

function applyClinicOffsetToUTC(date) {
  // The parsed date/time is in the clinic's local timezone (UTC-4).
  // Server Date constructors run in UTC, so shift by the offset to get the correct UTC instant.
  return new Date(date.getTime() - CLINIC_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

function getTotalDuration(services) {
  return (
    Object.values(services || {}).reduce((sum, service) => {
      return sum + (service.duration || 0) * (service.quantity || 1);
    }, 0) || 60
  );
}

function parseBookingDateTime(booking) {
  const dt = booking?.dateTime;
  if (!dt || typeof dt !== "object" || !dt.date || !dt.time) return null;

  const dateParts = parseDateString(dt.date);
  if (!dateParts || !dateParts.month) return null;

  const timeParts = parseTimeString(dt.time);
  if (!timeParts) return null;

  const parsedStart = new Date(
    `${dateParts.year}-${dateParts.month}-${dateParts.day}T${timeParts.hours}:${timeParts.minutes}:00`,
  );
  if (isNaN(parsedStart.getTime())) return null;

  const duration = getTotalDuration(booking.services);
  const startDate = applyClinicOffsetToUTC(parsedStart);
  const endDate = new Date(startDate.getTime() + duration * 60000);
  return { startDate, endDate };
}

function formatUTC(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function createGoogleCalendarUrl(booking) {
  const data = parseBookingDateTime(booking);
  if (!data) return null;

  const info = booking.customerInfo || {};
  const services = booking.services || {};
  const serviceNames = Object.values(services)
    .map((s) => s.name)
    .join(", ");
  const patientName = `${info.firstName || ""} ${info.lastName || ""}`.trim();

  const summary = encodeURIComponent("Cita - Dra. Cristabel Hernandez");
  const dates = `${formatUTC(data.startDate)}/${formatUTC(data.endDate)}`;
  const details = encodeURIComponent(
    [
      `Paciente: ${patientName || "N/A"}`,
      `Servicios: ${serviceNames || "No especificado"}`,
      `Clínica: Dra. Cristabel Hernandez`,
      `Teléfono: (829) 316-3313`,
      `Dirección: Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata`,
    ].join("\n"),
  );
  const location = encodeURIComponent(
    "Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata 57000, DO",
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${dates}&details=${details}&location=${location}`;
}

function createICSContent(booking) {
  const data = parseBookingDateTime(booking);
  if (!data) return null;

  const info = booking.customerInfo || {};
  const services = booking.services || {};
  const serviceNames = Object.values(services)
    .map((s) => s.name)
    .join(", ");
  const patientName = `${info.firstName || ""} ${info.lastName || ""}`.trim();

  const description = [
    `Paciente: ${patientName || "N/A"}`,
    `Servicios: ${serviceNames || "No especificado"}`,
    `Clínica: Dra. Cristabel Hernandez`,
    `Teléfono: (829) 316-3313`,
    `Dirección: Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata`,
  ].join("\\n");

  const uid = `cristabel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cristabel Hernandez//Booking//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUTC(new Date())}`,
    `DTSTART:${formatUTC(data.startDate)}`,
    `DTEND:${formatUTC(data.endDate)}`,
    "SUMMARY:Cita - Dra. Cristabel Hernandez",
    `DESCRIPTION:${description}`,
    "LOCATION:Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata 57000, DO",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function getICSFilename(booking) {
  const dt = booking?.dateTime;
  if (dt && typeof dt === "object" && dt.date) {
    const dateParts = parseDateString(dt.date);
    if (dateParts) {
      return `Cristabel-Reservation-${dateParts.year}-${dateParts.month}-${dateParts.day}.ics`;
    }
  }
  const now = new Date();
  return `Cristabel-Reservation-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.ics`;
}

function buildCalendarAttachment(booking) {
  const content = createICSContent(booking);
  if (!content) return null;
  return {
    filename: getICSFilename(booking),
    content: Buffer.from(content).toString("base64"),
    content_type: "text/calendar; method=PUBLISH",
  };
}

function buildCalendarSection(booking, includeICS = false) {
  const googleUrl = createGoogleCalendarUrl(booking);
  if (!googleUrl) return { html: "", text: "" };

  const icsHtml = includeICS
    ? `&nbsp;|&nbsp;<span>Adjuntamos también un archivo .ics para Apple Calendario, Outlook, etc.</span>`
    : "";
  const icsText = includeICS
    ? "\n- También adjuntamos un archivo .ics para Apple Calendario, Outlook, etc."
    : "";

  return {
    html: `
      <h3>Agregar tu cita al calendario</h3>
      <p>
        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer">Google Calendario</a>${icsHtml}
      </p>
    `,
    text: `
Agregar tu cita al calendario:
- Google Calendario: ${googleUrl}${icsText}
    `.trim(),
  };
}

function buildOwnerNotificationEmail(booking) {
  const info = booking.customerInfo || {};
  const services = booking.services || {};
  const total = calculateTotal(services);
  const dateTime = formatDateTime(booking.dateTime);
  const calendar = buildCalendarSection(booking, true);
  const attachment = buildCalendarAttachment(booking);

  return {
    subject: `Nueva reserva: ${info.firstName || ""} ${info.lastName || ""}`,
    html: `
      <h2>Nueva reserva recibida</h2>
      <p><strong>Paciente:</strong> ${info.firstName || ""} ${info.lastName || ""}</p>
      <p><strong>Email:</strong> ${info.email || ""}</p>
      <p><strong>Teléfono:</strong> ${info.phone || ""}</p>
      <p><strong>Tipo de paciente:</strong> ${booking.customerType || "—"}</p>
      <p><strong>Fecha y hora:</strong> ${dateTime}</p>
      <h3>Servicios</h3>
      <ul>${buildServicesList(services)}</ul>
      <p><strong>Total:</strong> ${formatPrice(total)}</p>
      ${calendar.html}
      ${info.note ? `<h3>Nota del paciente</h3><p>${info.note.replace(/\n/g, "<br>")}</p>` : ""}
    `,
    text: `
Nueva reserva recibida

Paciente: ${info.firstName || ""} ${info.lastName || ""}
Email: ${info.email || ""}
Teléfono: ${info.phone || ""}
Tipo de paciente: ${booking.customerType || "—"}
Fecha y hora: ${dateTime}

Servicios:
${Object.values(services)
  .map(
    (s) =>
      `- ${s.name} × ${s.quantity || 1} — ${formatPrice(s.price * (s.quantity || 1))}`,
  )
  .join("\n")}

Total: ${formatPrice(total)}

${calendar.text}
${info.note ? `\nNota del paciente:\n${info.note}` : ""}
    `.trim(),
    attachments: attachment ? [attachment] : [],
  };
}

function buildPatientConfirmationEmail(booking) {
  const info = booking.customerInfo || {};
  const services = booking.services || {};
  const total = calculateTotal(services);
  const dateTime = formatDateTime(booking.dateTime);
  const patientName =
    `${info.firstName || ""} ${info.lastName || ""}`.trim() || "Paciente";
  const calendar = buildCalendarSection(booking, false);
  const attachment = buildCalendarAttachment(booking);

  return {
    subject: "Confirmación de tu cita — Dra. Cristabel Hernandez",
    html: `
      <h2>Hola ${patientName},</h2>
      <p>Tu cita ha sido recibida. A continuación te compartimos los detalles:</p>
      <p><strong>Fecha y hora:</strong> ${dateTime}</p>
      <h3>Servicios</h3>
      <ul>${buildServicesList(services)}</ul>
      <p><strong>Total:</strong> ${formatPrice(total)}</p>
      ${calendar.html}
      <p>Te contactaremos pronto para confirmar tu cita.</p>
      <p>Si tienes alguna pregunta, puedes responder a este correo o escribirnos por WhatsApp. al (829) 316-3313</p>
      <hr>
      <p><strong>Dra. Cristabel Hernandez</strong><br>
      Teléfono: (829) 316-3313<br>
      Dirección: Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata</p>
    `,
    text: `
Hola ${patientName},

Tu cita ha sido recibida. A continuación te compartimos los detalles:

Fecha y hora: ${dateTime}

Servicios:
${Object.values(services)
  .map(
    (s) =>
      `- ${s.name} × ${s.quantity || 1} — ${formatPrice(s.price * (s.quantity || 1))}`,
  )
  .join("\n")}

Total: ${formatPrice(total)}

${calendar.text}

Te contactaremos pronto para confirmar tu cita.
Si tienes alguna pregunta, puedes responder a este correo o escribirnos por WhatsApp al (829) 316-3313.

---
Dra. Cristabel Hernandez
Teléfono: (829) 316-3313
Dirección: Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata
    `.trim(),
    attachments: attachment ? [attachment] : [],
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Missing RESEND_API_KEY environment variable");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }

  let booking;
  try {
    booking = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON payload" }),
    };
  }

  const info = booking.customerInfo || {};
  if (!info.email || !info.email.includes("@")) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Patient email is required" }),
    };
  }

  const resend = new Resend(apiKey);

  try {
    const ownerEmail = buildOwnerNotificationEmail(booking);
    const patientEmail = buildPatientConfirmationEmail(booking);

    const [ownerResult, patientResult] = await Promise.all([
      resend.emails.send({
        from: FROM_EMAIL,
        to: OWNER_EMAIL,
        reply_to: info.email,
        subject: ownerEmail.subject,
        html: ownerEmail.html,
        text: ownerEmail.text,
        ...(ownerEmail.attachments?.length
          ? { attachments: ownerEmail.attachments }
          : {}),
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: info.email,
        reply_to: OWNER_EMAIL,
        subject: patientEmail.subject,
        html: patientEmail.html,
        text: patientEmail.text,
        ...(patientEmail.attachments?.length
          ? { attachments: patientEmail.attachments }
          : {}),
      }),
    ]);

    if (ownerResult.error || patientResult.error) {
      console.error("Resend error:", { ownerResult, patientResult });
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Failed to send one or more emails",
          details: { ownerResult, patientResult },
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ownerEmailId: ownerResult.data?.id,
        patientEmailId: patientResult.data?.id,
      }),
    };
  } catch (error) {
    console.error("Error sending booking emails:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
