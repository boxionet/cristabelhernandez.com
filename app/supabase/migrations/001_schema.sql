-- =====================================================================
-- Cristabel Hernandez — booking system schema (Phase 1)
-- Plan: peachy-style-booking-portal-plan.md §3
--
-- Run in the Supabase SQL Editor (project bgahgawcjokcrpzkexvx).
-- Safe to re-run: every statement is idempotent where Postgres allows.
--
-- Design notes
-- * Email is the patient's identity key (verified via Supabase Auth).
--   Phone is contact info + the Panel's search key, never proof.
-- * Guest bookings start as status 'por_confirmar' with NO patient row:
--   the guest's data lives on the appointment (guest_*) until the owner
--   clicks "Confirmar mi cita", when the patient is created/linked and
--   patient_id is set. Unconfirmed holds expire (confirmation_expires_at)
--   and are purged by the Phase 2 sweep; until then they hold the slot.
-- * Double-booking is impossible at the database level: an exclusion
--   constraint rejects overlapping active appointments (single provider).
-- * RLS is enabled on every table. Inserts/updates of appointments happen
--   only through Netlify Functions (service role, bypasses RLS).
--   "Automatically expose new tables" is OFF for this project, so the
--   GRANTs at the bottom are explicit and deliberate.
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- exclusion constraint on ranges

-- ---------------------------------------------------------------------
-- Helper: is the current session the admin (Dra)?
-- Role lives in Supabase Auth app_metadata (server-set only).
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

-- ---------------------------------------------------------------------
-- patients — one row per verified email identity
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  full_name     text not null,
  email         text not null,
  phone         text,
  notes         text,
  no_show_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One patient per email, case-insensitive (the identity key).
create unique index if not exists patients_email_unique
  on public.patients (lower(email));
create index if not exists patients_phone_idx
  on public.patients (phone);

-- ---------------------------------------------------------------------
-- services — the catalog (seeded in 002_seed.sql with today's 13)
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text,
  category         text not null check (category in ('facial', 'corporal')),
  price            integer not null check (price >= 0), -- RD$, whole pesos
  price_from       boolean not null default false,      -- "desde"
  price_note       text,                                -- "c/ampolla", "3 sesiones"
  duration_minutes integer not null check (duration_minutes > 0),
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- weekly_schedule — one row per weekday (0 = Sunday … 6 = Saturday)
-- ---------------------------------------------------------------------
create table if not exists public.weekly_schedule (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null unique check (weekday between 0 and 6),
  is_open    boolean not null default true,
  open_time  time not null,
  close_time time not null,
  check (close_time > open_time)
);

-- ---------------------------------------------------------------------
-- date_exceptions — holidays, vacations, special hours
-- ---------------------------------------------------------------------
create table if not exists public.date_exceptions (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  is_closed  boolean not null default true,
  open_time  time,  -- only when is_closed = false and hours differ
  close_time time,
  label      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id                      uuid primary key default gen_random_uuid(),
  reference_code          text not null unique, -- generated by the create function (Phase 2)
  patient_id              uuid references public.patients (id) on delete set null,
  -- Guest data, used only while status = 'por_confirmar' (no patient yet)
  guest_name              text,
  guest_email             text,
  guest_phone             text,
  date                    date not null,
  start_time              time not null,
  duration_minutes        integer not null check (duration_minutes > 0),
  total_price             integer not null check (total_price >= 0), -- RD$
  total_is_estimate       boolean not null default false,
  status                  text not null default 'pendiente'
                          check (status in ('por_confirmar', 'pendiente', 'confirmada',
                                            'completada', 'cancelada', 'no_show')),
  payment_status          text not null default 'pendiente'
                          check (payment_status in ('pendiente', 'pagado')),
  payment_method          text check (payment_method in ('efectivo')),
  source                  text not null default 'web'
                          check (source in ('web', 'telefono', 'whatsapp', 'presencial')),
  idempotency_key         text unique,
  confirmation_token      uuid unique,          -- "Confirmar mi cita" link (guest bookings)
  confirmation_expires_at timestamptz,          -- min(24h after booking, 3h before start)
  starts_at               timestamptz not null, -- maintained by trigger (clinic tz)
  ends_at                 timestamptz not null, -- maintained by trigger
  internal_notes          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists appointments_date_idx    on public.appointments (date);
create index if not exists appointments_patient_idx on public.appointments (patient_id);
create index if not exists appointments_status_idx  on public.appointments (status);

-- Keep starts_at / ends_at in sync (America/Santo_Domingo wall time).
create or replace function public.set_appointment_range()
returns trigger
language plpgsql
as $$
begin
  new.starts_at := (new.date + new.start_time) at time zone 'America/Santo_Domingo';
  new.ends_at   := new.starts_at + make_interval(mins => new.duration_minutes);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists appointments_range on public.appointments;
create trigger appointments_range
  before insert or update of date, start_time, duration_minutes
  on public.appointments
  for each row execute function public.set_appointment_range();

-- One clinic, one chair: no two ACTIVE appointments may overlap.
-- 'por_confirmar' holds count until they expire and are purged.
alter table public.appointments
  drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at) with &&)
  where (status in ('por_confirmar', 'pendiente', 'confirmada'));

-- ---------------------------------------------------------------------
-- appointment_services — line items with price snapshot at booking time
-- ---------------------------------------------------------------------
create table if not exists public.appointment_services (
  id           uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  service_name text not null,
  unit_price   integer not null check (unit_price >= 0),
  quantity     integer not null default 1 check (quantity > 0),
  price_from   boolean not null default false,
  price_note   text
);

create index if not exists appointment_services_appt_idx
  on public.appointment_services (appointment_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance for patients / services
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists patients_touch on public.patients;
create trigger patients_touch
  before update on public.patients
  for each row execute function public.touch_updated_at();

drop trigger if exists services_touch on public.services;
create trigger services_touch
  before update on public.services
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.patients            enable row level security;
alter table public.services            enable row level security;
alter table public.weekly_schedule     enable row level security;
alter table public.date_exceptions     enable row level security;
alter table public.appointments        enable row level security;
alter table public.appointment_services enable row level security;

-- services: anyone may read active services (prices are public on the
-- site); only admin writes.
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon, authenticated
  using (active = true or public.is_admin());

drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- schedule + exceptions: public read (working hours are public), admin write.
drop policy if exists weekly_schedule_public_read on public.weekly_schedule;
create policy weekly_schedule_public_read on public.weekly_schedule
  for select to anon, authenticated using (true);

drop policy if exists weekly_schedule_admin_write on public.weekly_schedule;
create policy weekly_schedule_admin_write on public.weekly_schedule
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists date_exceptions_public_read on public.date_exceptions;
create policy date_exceptions_public_read on public.date_exceptions
  for select to anon, authenticated using (true);

drop policy if exists date_exceptions_admin_write on public.date_exceptions;
create policy date_exceptions_admin_write on public.date_exceptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- patients: a patient reads/updates only her own row; admin sees all.
-- Inserts happen via Functions (service role) or on first verified login.
drop policy if exists patients_self_read on public.patients;
create policy patients_self_read on public.patients
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists patients_self_update on public.patients;
create policy patients_self_update on public.patients
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists patients_admin_write on public.patients;
create policy patients_admin_write on public.patients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- appointments: a patient reads only her own; admin reads all.
-- No anon/authenticated INSERT or UPDATE policy on purpose: booking,
-- cancel and reschedule go through Netlify Functions (service role),
-- which enforce the 24h window, confirmation and conflict rules.
drop policy if exists appointments_self_read on public.appointments;
create policy appointments_self_read on public.appointments
  for select to authenticated
  using (
    public.is_admin()
    or patient_id in (select id from public.patients where auth_user_id = auth.uid())
  );

drop policy if exists appointments_admin_write on public.appointments;
create policy appointments_admin_write on public.appointments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- appointment_services: readable when the parent appointment is readable.
drop policy if exists appointment_services_read on public.appointment_services;
create policy appointment_services_read on public.appointment_services
  for select to authenticated
  using (
    public.is_admin()
    or appointment_id in (
      select a.id
      from public.appointments a
      join public.patients p on p.id = a.patient_id
      where p.auth_user_id = auth.uid()
    )
  );

drop policy if exists appointment_services_admin_write on public.appointment_services;
create policy appointment_services_admin_write on public.appointment_services
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- Grants (project has "Automatically expose new tables" OFF)
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select on public.services, public.weekly_schedule, public.date_exceptions
  to anon, authenticated;
grant select, update on public.patients to authenticated;
grant select on public.appointments, public.appointment_services to authenticated;

-- Admin write paths run as authenticated + is_admin() policies above;
-- the matching table privileges:
grant insert, update, delete on public.services, public.weekly_schedule,
  public.date_exceptions, public.appointments, public.appointment_services
  to authenticated;
grant insert, delete on public.patients to authenticated;

-- Functions (service role) can do everything; RLS is bypassed for it.
grant all on all tables in schema public to service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
