const { Resend } = require('resend');

const OWNER_EMAIL = 'cristabel@cristabelhernandez.com';
const FROM_EMAIL = 'cristabel@cristabelhernandez.com';

function formatPrice(amount) {
  if (amount === undefined || amount === null) return 'RD$ 0';
  return `RD$ ${Math.round(amount).toLocaleString('en-US')}`;
}

function formatDateTime(dateTime) {
  if (!dateTime) return '—';
  if (typeof dateTime === 'object' && dateTime.date && dateTime.time) {
    return `${dateTime.date} · ${dateTime.time}`;
  }
  if (typeof dateTime === 'string') {
    return dateTime;
  }
  return '—';
}

function buildServicesList(services) {
  const items = Object.values(services || {});
  if (items.length === 0) return '<li>No se seleccionaron servicios</li>';

  return items
    .map((service) => {
      const qty = service.quantity || 1;
      const total = service.price * qty;
      return `<li>${service.name} × ${qty} — ${formatPrice(total)}</li>`;
    })
    .join('');
}

function calculateTotal(services) {
  return Object.values(services || {}).reduce((sum, service) => {
    return sum + service.price * (service.quantity || 1);
  }, 0);
}

function buildOwnerNotificationEmail(booking) {
  const info = booking.customerInfo || {};
  const services = booking.services || {};
  const total = calculateTotal(services);
  const dateTime = formatDateTime(booking.dateTime);

  return {
    subject: `Nueva reserva: ${info.firstName || ''} ${info.lastName || ''}`,
    html: `
      <h2>Nueva reserva recibida</h2>
      <p><strong>Paciente:</strong> ${info.firstName || ''} ${info.lastName || ''}</p>
      <p><strong>Email:</strong> ${info.email || ''}</p>
      <p><strong>Teléfono:</strong> ${info.phone || ''}</p>
      <p><strong>Tipo de paciente:</strong> ${booking.customerType || '—'}</p>
      <p><strong>Fecha y hora:</strong> ${dateTime}</p>
      <h3>Servicios</h3>
      <ul>${buildServicesList(services)}</ul>
      <p><strong>Total:</strong> ${formatPrice(total)}</p>
      ${info.note ? `<h3>Nota del paciente</h3><p>${info.note.replace(/\n/g, '<br>')}</p>` : ''}
    `,
    text: `
Nueva reserva recibida

Paciente: ${info.firstName || ''} ${info.lastName || ''}
Email: ${info.email || ''}
Teléfono: ${info.phone || ''}
Tipo de paciente: ${booking.customerType || '—'}
Fecha y hora: ${dateTime}

Servicios:
${Object.values(services)
  .map((s) => `- ${s.name} × ${s.quantity || 1} — ${formatPrice(s.price * (s.quantity || 1))}`)
  .join('\n')}

Total: ${formatPrice(total)}
${info.note ? `\nNota del paciente:\n${info.note}` : ''}
    `.trim(),
  };
}

function buildPatientConfirmationEmail(booking) {
  const info = booking.customerInfo || {};
  const services = booking.services || {};
  const total = calculateTotal(services);
  const dateTime = formatDateTime(booking.dateTime);
  const patientName = `${info.firstName || ''} ${info.lastName || ''}`.trim() || 'Paciente';

  return {
    subject: 'Confirmación de tu cita — Dr. Cristabel Hernandez',
    html: `
      <h2>Hola ${patientName},</h2>
      <p>Tu cita ha sido recibida. A continuación te compartimos los detalles:</p>
      <p><strong>Fecha y hora:</strong> ${dateTime}</p>
      <h3>Servicios</h3>
      <ul>${buildServicesList(services)}</ul>
      <p><strong>Total:</strong> ${formatPrice(total)}</p>
      <p>Te contactaremos pronto para confirmar tu cita.</p>
      <p>Si tienes alguna pregunta, puedes responder a este correo o escribirnos por WhatsApp.</p>
      <hr>
      <p><strong>Dr. Cristabel Hernandez</strong><br>
      Teléfono: (829) 316-3313<br>
      Dirección: Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata</p>
    `,
    text: `
Hola ${patientName},

Tu cita ha sido recibida. A continuación te compartimos los detalles:

Fecha y hora: ${dateTime}

Servicios:
${Object.values(services)
  .map((s) => `- ${s.name} × ${s.quantity || 1} — ${formatPrice(s.price * (s.quantity || 1))}`)
  .join('\n')}

Total: ${formatPrice(total)}

Te contactaremos pronto para confirmar tu cita.
Si tienes alguna pregunta, puedes responder a este correo o escribirnos por WhatsApp.

---
Dr. Cristabel Hernandez
Teléfono: (829) 316-3313
Dirección: Calle Beller No. 129, Plaza Metropolis 2ndo Nivel, Puerto Plata
    `.trim(),
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Missing RESEND_API_KEY environment variable');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  let booking;
  try {
    booking = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const info = booking.customerInfo || {};
  if (!info.email || !info.email.includes('@')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Patient email is required' }),
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
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: info.email,
        reply_to: OWNER_EMAIL,
        subject: patientEmail.subject,
        html: patientEmail.html,
        text: patientEmail.text,
      }),
    ]);

    if (ownerResult.error || patientResult.error) {
      console.error('Resend error:', { ownerResult, patientResult });
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send one or more emails',
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
    console.error('Error sending booking emails:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
