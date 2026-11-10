// Shared reCAPTCHA v2 verification (same secret/site key as the
// contact form). Returns { configured, success }.
async function verifyRecaptcha(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { configured: false, success: false };
  if (!token) return { configured: true, success: false };
  try {
    const params = new URLSearchParams({ secret, response: String(token) });
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
    return { configured: true, success: result.success === true };
  } catch (e) {
    console.error("recaptcha verify failed", e);
    return { configured: true, success: false };
  }
}

module.exports = { verifyRecaptcha };
