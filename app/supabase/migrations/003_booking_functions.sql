-- =====================================================================
-- Booking engine (Phase 2) — atomic RPCs used by the Netlify Functions.
--
-- All three functions are SECURITY DEFINER and executable ONLY by the
-- service role: every booking action goes through a Netlify Function
-- (which enforces reCAPTCHA/rate limits in Phase 6 and shapes emails).
-- The database still owns the invariants: totals are computed from the
-- services table (never from client-sent prices), idempotency is a
-- unique key, and the Phase 1 exclusion constraint rejects overlaps.
-- =====================================================================

-- Per-appointment secret for the tokenized manage links in emails
-- (cancel/reschedule without a login — plan's impersonation guard).
alter table public.appointments
  add column if not exists manage_token uuid unique default gen_random_uuid();

-- ---------------------------------------------------------------------
-- create_booking
--   p_items: [{"slug":"toxina-frontal","quantity":1}, ...]
--   Verified callers (Supabase Auth session, email verified) pass
--   p_auth_user_id + p_verified = true and get a linked patient row.
--   Guests get a 'por_confirmar' hold: NO patient row is created until
--   confirm_booking() runs from the emailed link.
--   Returns the appointment row. Raises:
--     'unknown_service'  — a slug is missing/inactive
--     'invalid_items'    — empty or malformed item list
--     23P01 (exclusion)  — the slot overlaps an active appointment
--     23505 (unique)     — lost an idempotency/reference race; the
--                          caller re-reads by idempotency_key
-- ---------------------------------------------------------------------
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
  p_source        text default 'web'
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
        status, source, idempotency_key,
        confirmation_token, confirmation_expires_at
      ) values (
        v_ref,
        v_patient_id,
        case when p_verified then null else p_name end,
        case when p_verified then null else p_email end,
        case when p_verified then null else p_phone end,
        p_date, p_start_time, v_duration, v_total, v_estimate,
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

-- ---------------------------------------------------------------------
-- confirm_booking — the "Confirmar mi cita" link target.
-- Returns jsonb: {result: 'confirmed'|'expired'|'invalid', appointment}
-- On confirm: the patient is created (or matched by email) and linked;
-- guest fields are cleared because the data now lives on the patient.
-- ---------------------------------------------------------------------
create or replace function public.confirm_booking(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt       public.appointments;
  v_patient_id uuid;
begin
  select * into v_appt
  from public.appointments
  where confirmation_token = p_token and status = 'por_confirmar'
  for update;

  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;

  if v_appt.confirmation_expires_at is not null
     and v_appt.confirmation_expires_at < now() then
    delete from public.appointments where id = v_appt.id;
    return jsonb_build_object('result', 'expired');
  end if;

  select id into v_patient_id
  from public.patients
  where lower(email) = lower(v_appt.guest_email);

  if v_patient_id is null then
    insert into public.patients (full_name, email, phone)
    values (v_appt.guest_name, v_appt.guest_email, v_appt.guest_phone)
    returning id into v_patient_id;
  end if;

  update public.appointments
  set patient_id = v_patient_id,
      status = 'pendiente',
      confirmation_token = null,
      confirmation_expires_at = null,
      guest_name = null, guest_email = null, guest_phone = null
  where id = v_appt.id
  returning * into v_appt;

  return jsonb_build_object(
    'result', 'confirmed',
    'appointment', to_jsonb(v_appt)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- purge_expired_holds — deletes unconfirmed guest holds past expiry.
-- Called by the booking-sweep scheduled function every 15 minutes.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.appointments
  where status = 'por_confirmar'
    and confirmation_expires_at is not null
    and confirmation_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only the service role (Netlify Functions) may run the engine.
revoke all on function public.create_booking(jsonb, date, time, text, text, text, boolean, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.confirm_booking(uuid)
  from public, anon, authenticated;
revoke all on function public.purge_expired_holds()
  from public, anon, authenticated;
grant execute on function public.create_booking(jsonb, date, time, text, text, text, boolean, uuid, text, text)
  to service_role;
grant execute on function public.confirm_booking(uuid) to service_role;
grant execute on function public.purge_expired_holds() to service_role;
