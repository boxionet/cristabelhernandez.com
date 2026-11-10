# Mi Cuenta + Panel — web app

One React + TypeScript (Vite) app serving both gated areas of the
booking system (plan: `peachy-style-booking-portal-plan.md` §2):

- `/mi-cuenta/*` — patient portal
- `/panel/*` — staff dashboard (admin role)

Data comes from Supabase via supabase-js with Row Level Security;
Netlify Functions handle privileged operations only (guest booking
creation, patient merge, Resend emails). The app talks to the backend
over HTTP only and never imports Eleventy internals, so this folder can
be lifted into its own repo later.

## Build

The root site build runs this app automatically (`build:app` in the
root `package.json`, after the Eleventy build). Vite outputs to
`../public/app`; Netlify redirects `/mi-cuenta/*` and `/panel/*` to
`/app/index.html`.

## Environment

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — build-time (Netlify).
- Server-side Functions use `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` from Netlify env vars at runtime.

## Database

Migrations live in `supabase/migrations/` and are applied manually in
the Supabase SQL Editor (project `bgahgawcjokcrpzkexvx`, us-east-1).
001 schema + RLS · 002 seed (13 services, Mon–Fri 09:00–18:00) ·
003 booking RPCs · 004 service sort_order fix · 005 reminder_sent_at.

## Runbook

- **Grant the admin role** (one time per staff account): the person
  signs in once at `/mi-cuenta/login` (creates their Auth account),
  then in the SQL Editor:
  `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb where email = '<their email>';`
  They land on `/panel/` at the next sign-in.
- **Auth settings that must stay as configured**: Email OTP length =
  6 (Authentication → Sign In/Providers → Email); custom SMTP =
  Resend; BOTH email templates ("Magic link or OTP" and "Confirm
  signup") are customized in Spanish with `{{ .Token }}` + the
  confirmation link; redirect allowlist = production
  `https://cristabelhernandez.com/**` (plus the Deploy Preview URL
  while testing — remove it at go-live).
- **Scheduled functions**: `booking-sweep` every 15 min purges
  expired unconfirmed holds; `booking-reminders` hourly emails the
  24 h reminder (citas starting in 23–25 h, once each, tracked by
  `appointments.reminder_sent_at`). Scheduled functions only run on
  the production deploy; a manual POST runs the same handler (used
  for tests on previews).
- **Bot protection**: guest `booking-create` calls must carry an
  invisible reCAPTCHA v2 token (`RECAPTCHA_SECRET_KEY` in Netlify
  env; same site key as the contact form). Verified sessions skip
  it. A failed check returns `captcha_failed` and the public flow
  falls back to the legacy email booking for that submission —
  that fallback is removed at the Phase 7 cutover.
- **Tests**: `supabase/tests/phase2_engine_tests.sql` (engine,
  run in the SQL Editor); anon-key requests to `patients` /
  `appointments` must return 401 (RLS + grants), the catalog
  (`services`) is public by design.
