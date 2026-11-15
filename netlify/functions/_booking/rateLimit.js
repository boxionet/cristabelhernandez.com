// Shared per-IP throttle for the public booking endpoints.
//
// Each request counts against a fixed 60-second window for its
// (endpoint, client IP) key, enforced atomically by the
// check_rate_limit RPC (migration 009). Limits are set per endpoint
// at the call site, well above human use: the lookup and promo
// checks sit at 10/min to kill reference/code guessing, availability
// at 60/min for calendar browsing, creates at 10/min as a backstop
// behind the captcha.
//
// Fail-open by design: if the counters are unreachable (or the
// migration has not been applied yet), the request proceeds and the
// failure is logged. A counters outage must never block real
// patients; the captcha and verify-first guards still protect the
// write endpoints.
const { serviceClient } = require("./supabase");

function getClientIp(event) {
  const h = event.headers || {};
  return (
    h["x-nf-client-connection-ip"] ||
    h["client-ip"] ||
    (typeof h["x-forwarded-for"] === "string"
      ? h["x-forwarded-for"].split(",")[0].trim()
      : null) ||
    "unknown"
  );
}

async function checkRateLimit(event, endpoint, limit, windowSeconds = 60) {
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: `rl:${endpoint}:${getClientIp(event)}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return {
      allowed: data?.allowed !== false,
      remaining: data?.remaining ?? limit,
      resetAfter: data?.reset_after ?? windowSeconds,
    };
  } catch (e) {
    console.error("rate_limit_check_failed", e);
    return { allowed: true, remaining: limit, resetAfter: 0 };
  }
}

function rateLimited(resetAfter) {
  return {
    statusCode: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(resetAfter, 1)),
    },
    body: JSON.stringify({ error: "rate_limited" }),
  };
}

module.exports = { checkRateLimit, rateLimited };
