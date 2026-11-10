// Shared Supabase access for the booking functions.
// Server-side only: the service-role key bypasses RLS, so every public
// rule (24h window, confirmation, conflicts) is enforced in this layer
// and in the database RPCs — never trust the client.
const { createClient } = require("@supabase/supabase-js");

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_supabase_env");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Resolve the caller from an Authorization: Bearer <supabase-jwt> header.
// Returns null when no header is present (guest), throws on a bad token.
async function getAuthUser(event) {
  const header =
    event.headers.authorization || event.headers.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("missing_supabase_env");
  const client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data || !data.user) {
    const err = new Error("invalid_token");
    err.statusCode = 401;
    throw err;
  }
  return data.user;
}

// A login counts as "verified" when Supabase Auth has confirmed the
// email (OTP/magic-link sign-in sets email_confirmed_at).
function isVerified(user) {
  return Boolean(user && user.email && user.email_confirmed_at);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function siteOrigin(event) {
  const host = event.headers.host || event.headers.Host;
  if (host) {
    const proto = host.startsWith("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return "https://cristabelhernandez.com";
}

module.exports = { serviceClient, getAuthUser, isVerified, json, siteOrigin };
