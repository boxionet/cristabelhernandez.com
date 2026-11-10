// Public client configuration for the booking pages: the Supabase URL
// and ANON key. The anon key is safe to expose (it ships in the React
// app bundle too) — Row Level Security decides what it can read.
exports.handler = async () => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  },
  body: JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  }),
});
