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
