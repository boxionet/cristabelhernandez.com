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
003 booking RPCs · 004 service sort_order fix · 005 reminder_sent_at ·
006 approval model (confirm_booking: web -> pendiente, staff-created -> confirmada).

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
- **Approval model (2026-11-11)**: every online booking lands in
  `pendiente` and waits for the Dra in Citas (Aprobar / No aprobar);
  approval sends the patient the confirmation email with the calendar
  invite, rejection cancels + emails the patient. The decision runs
  through `booking-decide` (admin session required) so the status
  change and the email happen together. Guest holds confirmed via
  the email link become `pendiente`; staff-created holds (manual
  booking with an email, via `booking-request-confirmation`) resolve
  straight to `confirmada` — the Dra already decided by creating
  them; manual bookings without an email are `confirmada` at once.
  Panel Confirmar on a hold is the approval itself (`confirmada`).
  A patient rescheduling a `confirmada` cita drops it back to
  `pendiente` (staff moves keep the status). Nothing sent before
  approval carries a calendar invite. `booking-confirm` maps the RPC
  outcome to the confirmation page's `estado` values (`confirmada` /
  `pendiente` / `expirada` / invalid) — the raw RPC values never
  matched the page, a latent Phase 3 bug fixed with this model.
- **Scheduled functions**: `booking-sweep` every 15 min purges
  expired unconfirmed holds; `booking-reminders` hourly emails the
  24 h reminder for `confirmada` citas only (starting in 23–25 h,
  once each, tracked by `appointments.reminder_sent_at` — pending
  requests are never reminded). Scheduled functions only run on
  the production deploy; a manual POST runs the same handler (used
  for tests on previews).
- **Bot protection**: guest `booking-create` calls must carry an
  invisible reCAPTCHA v2 token (`RECAPTCHA_SECRET_KEY` in Netlify
  env; same site key as the contact form). Verified sessions skip
  it. A failed check returns `captcha_failed` and the public flow
  (Before go-live the public flow fell back to a legacy email
  booking for that submission; the fallback and the legacy
  `send-booking-email` function were removed at the Phase 7
  cutover, 2026-11-11 — the engine is now the only booking path
  and failures surface an error to the patient.)
- **Tests**: `supabase/tests/phase2_engine_tests.sql` (engine,
  run in the SQL Editor); anon-key requests to `patients` /
  `appointments` must return 401 (RLS + grants), the catalog
  (`services`) is public by design.

## App architecture (state & data)

- **Redux Toolkit** (`app/src/store/`) holds client state only:
  `slices/authSlice.ts` (Supabase session + linked patient;
  `linkPatientThunk`), `slices/uiSlice.ts` (cross-screen UI state:
  Agenda date, Reportes month, Citas filters). Add one slice per
  feature under `slices/`; components use the typed hooks in
  `store/hooks.ts`. Form-local state stays in components on purpose.
- **TanStack Query** (`app/src/lib/queryClient.ts`, keys in
  `lib/queries/keys.ts`) owns all server state: panel collections
  (`lib/queries/panelQueries.ts`), patient appointments
  (`lib/queries/patientQueries.ts`), availability
  (`lib/queries/availability.ts`). Writes stay as imperative
  functions (RLS writes in `lib/panel.ts`, function calls in
  `lib/api.ts`) and finish by invalidating the matching query keys
  (`usePanelData().reload()` / `useAppointments().reload()`).
- `auth.tsx` is only a bridge: it mirrors the Supabase session
  listener into the auth slice and exposes the `useAuth()` facade.
