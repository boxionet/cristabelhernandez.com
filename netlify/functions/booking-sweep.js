// Scheduled sweep: purge guest holds that were never confirmed
// (decision B — expired 'por_confirmar' rows release their slot).
// Runs every 15 minutes via Netlify Scheduled Functions.
const { serviceClient } = require("./_booking/supabase");

exports.config = { schedule: "*/15 * * * *" };

exports.handler = async () => {
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("purge_expired_holds");
    if (error) throw error;
    console.log(`booking-sweep: purged ${data} expired holds`);
    return { statusCode: 200, body: JSON.stringify({ purged: data }) };
  } catch (e) {
    console.error("booking-sweep error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "sweep_failed" }) };
  }
};
