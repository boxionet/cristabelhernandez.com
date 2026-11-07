const { Resend } = require("resend");

// Contact form messages go to the clinic's public inbox.
const CONTACT_EMAIL = "hola@cristabelhernandez.com";
const FROM_EMAIL = "cristabel@mail.cristabelhernandez.com";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function verifyRecaptcha(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { configured: false, success: false };

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.append("remoteip", remoteIp);

  const response = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );
  const result = await response.json();
  return { configured: true, success: result.success === true, result };
}

exports.handler = async (event) => {
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

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON payload" }),
    };
  }

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  const service = String(payload.service || "").trim();
  const message = String(payload.message || "").trim();
  const token = String(payload.recaptchaToken || "").trim();

  if (!name || !email || !email.includes("@") || !phone || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid form fields" }),
    };
  }
  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing reCAPTCHA token" }),
    };
  }

  // Verify the invisible reCAPTCHA before sending anything.
  let captcha;
  try {
    const remoteIp =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["client-ip"] ||
      undefined;
    captcha = await verifyRecaptcha(token, remoteIp);
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "reCAPTCHA verification error" }),
    };
  }
  if (!captcha.configured) {
    console.error("Missing RECAPTCHA_SECRET_KEY environment variable");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }
  if (!captcha.success) {
    console.error("reCAPTCHA verification failed:", captcha.result);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "reCAPTCHA verification failed" }),
    };
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: CONTACT_EMAIL,
      reply_to: email,
      subject: `Nuevo mensaje de contacto — ${name}`,
      html: `
        <h2>Nuevo mensaje desde el formulario de contacto</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Correo electrónico:</strong> ${escapeHtml(email)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Tratamiento de interés:</strong> ${escapeHtml(service || "No especificado")}</p>
        <h3>Mensaje</h3>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
      text: `
Nuevo mensaje desde el formulario de contacto

Nombre: ${name}
Correo electrónico: ${email}
Teléfono: ${phone}
Tratamiento de interés: ${service || "No especificado"}

Mensaje:
${message}
      `.trim(),
    });

    if (result.error) {
      console.error("Resend error:", result);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to send email" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, emailId: result.data?.id }),
    };
  } catch (error) {
    console.error("Error sending contact email:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
