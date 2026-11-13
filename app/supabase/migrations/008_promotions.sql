-- =====================================================================
-- 008_promotions.sql — promo codes (percentage discounts) for bookings
--
-- * promotions: one row per code. The Dra manages them from the Panel
--   (Promociones section). Codes are stored normalized: UPPERCASE,
--   no spaces. A code is redeemable while active, the appointment
--   date falls inside its validity window (when set), and its use
--   count stays under max_uses (when set).
-- * appointments gains the promo SNAPSHOT: code, percent, discount
--   amount and pre-discount subtotal, frozen at booking time. Later
--   edits or deactivation of a code never rewrite history — the same
--   snapshot principle as appointment_services prices.
-- * Uses are DERIVED, not counted: redemptions = appointments
--   carrying the code whose status is not 'cancelada'. Expired holds
--   are deleted by the sweep, so they stop counting on their own;
--   cancellations free the use with no extra code path. The race on
--   the last use is closed by locking the promotion row inside
--   create_booking before counting.
-- * The validity window compares against the APPOINTMENT date: a
--   "December promo" covers December appointments, whenever booked.
-- * create_booking gains p_promo_code (appended, default null). The
--   old 10-argument overload is dropped so no caller can bypass the
--   promo logic; booking-create.js is the only RPC caller.
-- =====================================================================

create table if not exists public.promotions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique
                   check (code ~ '^[A-Z0-9][A-Z0-9\-]{2,19}$'),
  discount_percent integer not null
                   check (discount_percent >= 1 and discount_percent <= 100),
  active           boolean not null default true,
  valid_from       date,
  valid_until      date,
  max_uses         integer check (max_uses is null or max_uses > 0),
  created_at       timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

alter table public.promotions enable row level security;

-- Promotions are NEVER publicly readable: the list of codes must not
-- be enumerable. Admins manage them from the Panel; the public
-- booking flow validates a single code through the
-- booking-promo-validate function (service role).
drop policy if exists promotions_admin_all on public.promotions;
create policy promotions_admin_all on public.promotions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Promo snapshot on appointments. subtotal_price is backfilled to the
-- current total for the rows that predate promos (they had no code).
alter table public.appointments
  add column if not exists promo_code text,
  add column if not exists discount_percent integer
    check (discount_percent is null
           or (discount_percent >= 1 and discount_percent <= 100)),
  add column if not exists discount_amount integer
    check (discount_amount is null or discount_amount >= 0),
  add column if not exists subtotal_price integer
    check (subtotal_price is null or subtotal_price >= 0);

update public.appointments
set subtotal_price = total_price
where subtotal_price is null;

create index if not exists appointments_promo_code_idx
  on public.appointments (promo_code)
  where promo_code is not null;

-- ---------------------------------------------------------------------
-- create_booking — same engine as migration 003, plus promo handling.
-- Totals still come from the catalog, never from the client; the
-- discount is computed server-side from the stored percent.
-- Raises 'invalid_promo' (unknown / inactive / outside the window)
-- or 'promo_exhausted' (use cap reached); booking-create maps both
-- to a 400 the patient can act on.
-- ---------------------------------------------------------------------
drop function if exists public.create_booking(
  jsonb, date, time, text, text, text, boolean, uuid, text, text
);

create or replace function public.create_booking(
  p_items         jsonb,
  p_date          date,
  p_start_time    time,
  p_name          text,
  p_email         text,
  p_phone         text,
  p_verified      boolean,
  p_auth_user_id  uuid,
  p_idempotency_key text,
  p_source        text default 'web',
  p_promo_code    text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing   public.appointments;
  v_patient_id uuid;
  v_total      integer := 0;
  v_subtotal   integer := 0;
  v_duration   integer := 0;
  v_estimate   boolean := false;
  v_item       jsonb;
  v_service    public.services;
  v_qty        integer;
  v_appt       public.appointments;
  v_ref        text;
  v_starts     timestamptz;
  v_expires    timestamptz;
  v_attempt    integer;
  v_code       text;
  v_promo      public.promotions;
  v_used       integer;
  v_discount   integer := 0;
begin
  -- Idempotency: a retry with the same key returns the original row.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.appointments
    where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 10 then
    raise exception 'invalid_items';
  end if;

  -- Totals come from the catalog, never from the client.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service
    from public.services
    where slug = v_item ->> 'slug' and active = true;
    if not found then
      raise exception 'unknown_service';
    end if;
    v_qty := coalesce((v_item ->> 'quantity')::integer, 1);
    if v_qty < 1 or v_qty > 10 then
      raise exception 'invalid_items';
    end if;
    v_total    := v_total + v_service.price * v_qty;
    v_duration := v_duration + v_service.duration_minutes * v_qty;
    v_estimate := v_estimate or v_service.price_from or (v_service.price_note is not null);
  end loop;
  v_subtotal := v_total;

  -- Promo code: normalized, then validated under a row lock so two
  -- concurrent bookings cannot both take the last use. The window
  -- compares against the appointment date (see header note).
  if p_promo_code is not null and btrim(p_promo_code) <> '' then
    v_code := upper(btrim(p_promo_code));
    select * into v_promo
    from public.promotions
    where code = v_code
    for update;
    if not found or not v_promo.active then
      raise exception 'invalid_promo';
    end if;
    if v_promo.valid_from is not null and p_date < v_promo.valid_from then
      raise exception 'invalid_promo';
    end if;
    if v_promo.valid_until is not null and p_date > v_promo.valid_until then
      raise exception 'invalid_promo';
    end if;
    if v_promo.max_uses is not null then
      select count(*) into v_used
      from public.appointments
      where promo_code = v_code and status <> 'cancelada';
      if v_used >= v_promo.max_uses then
        raise exception 'promo_exhausted';
      end if;
    end if;
    v_discount := round(v_total * v_promo.discount_percent / 100.0)::integer;
    v_total := v_total - v_discount;
  end if;

  v_starts := (p_date + p_start_time) at time zone 'America/Santo_Domingo';

  if p_verified then
    -- Patient matching is by verified email (the identity key).
    select id into v_patient_id
    from public.patients
    where lower(email) = lower(p_email);

    if v_patient_id is null then
      insert into public.patients (auth_user_id, full_name, email, phone)
      values (p_auth_user_id, p_name, p_email, p_phone)
      returning id into v_patient_id;
    else
      update public.patients
      set auth_user_id = coalesce(auth_user_id, p_auth_user_id),
          phone = coalesce(phone, p_phone)
      where id = v_patient_id;
    end if;
  end if;

  if not p_verified then
    -- Decision B: hold expires at min(booking + 24h, start - 3h),
    -- floored so a same-day booking still gets a workable window.
    v_expires := least(now() + interval '24 hours', v_starts - interval '3 hours');
    if v_expires < now() + interval '15 minutes' then
      v_expires := greatest(v_starts - interval '15 minutes', now() + interval '15 minutes');
    end if;
  end if;

  -- Reference code with a small retry loop on collision.
  for v_attempt in 1..5 loop
    v_ref := 'CH-' || (
      select string_agg(
               substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
                      1 + floor(random() * 31)::integer, 1), '')
      from generate_series(1, 6)
    );
    begin
      insert into public.appointments (
        reference_code, patient_id, guest_name, guest_email, guest_phone,
        date, start_time, duration_minutes, total_price, total_is_estimate,
        promo_code, discount_percent, discount_amount, subtotal_price,
        status, source, idempotency_key,
        confirmation_token, confirmation_expires_at
      ) values (
        v_ref,
        v_patient_id,
        case when p_verified then null else p_name end,
        case when p_verified then null else p_email end,
        case when p_verified then null else p_phone end,
        p_date, p_start_time, v_duration, v_total, v_estimate,
        case when v_code is not null then v_code else null end,
        case when v_code is not null then v_promo.discount_percent else null end,
        case when v_code is not null then v_discount else null end,
        v_subtotal,
        case when p_verified then 'pendiente' else 'por_confirmar' end,
        coalesce(p_source, 'web'),
        p_idempotency_key,
        case when p_verified then null else gen_random_uuid() end,
        v_expires
      )
      returning * into v_appt;
      exit; -- inserted
    exception
      when unique_violation then
        -- Reference-code collision: retry. Idempotency-key collision:
        -- another request won the race — return its row.
        if p_idempotency_key is not null then
          select * into v_existing
          from public.appointments
          where idempotency_key = p_idempotency_key;
          if found then
            return v_existing;
          end if;
        end if;
        if v_attempt = 5 then raise; end if;
      -- exclusion_violation (23P01) is NOT caught: it propagates as
      -- "slot taken" to the caller.
    end;
  end loop;

  -- Line items with the price snapshot.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service
    from public.services
    where slug = v_item ->> 'slug';
    insert into public.appointment_services (
      appointment_id, service_id, service_name, unit_price, quantity,
      price_from, price_note
    ) values (
      v_appt.id, v_service.id, v_service.name, v_service.price,
      coalesce((v_item ->> 'quantity')::integer, 1),
      v_service.price_from, v_service.price_note
    );
  end loop;

  return v_appt;
end;
$$;

-- Only the service role (Netlify Functions) may run the engine.
revoke all on function public.create_booking(
  jsonb, date, time, text, text, text, boolean, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_booking(
  jsonb, date, time, text, text, text, boolean, uuid, text, text, text
) to service_role;
