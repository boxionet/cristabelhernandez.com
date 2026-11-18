-- ======================================================================
-- 010_manual_override.sql — Doctor's manual time override (Panel).
--
-- User decision 2026-11-17: the Dra can create a cita from the Panel at
-- whatever time she wants, even overlapping another cita. The flag
-- exempts ONLY that row from overlap enforcement; every other booking
-- (online patients, normal manual bookings, reschedules) keeps the
-- database-level guarantee that double-booking is impossible.
--
-- Apply in the Supabase SQL Editor, then verify with the commented
-- transaction test at the bottom (it rolls back: no data changes).
-- Safe to apply BEFORE the app code ships: existing rows get
-- manual_override = false, and all current writes behave exactly as
-- before. No new grants needed (a column, not a table).
-- ======================================================================

alter table public.appointments
  add column if not exists manual_override boolean not null default false;

comment on column public.appointments.manual_override is
  'Doctor override (Panel Nueva cita manual): this cita was placed at a manually chosen time and may overlap other active citas. Only the Dra can create such rows, from the Panel. Cleared automatically when the patient reschedules online.';

-- The exclusion constraint now covers non-override rows only. On its
-- own this would open a gap: a normal booking landing on an override
-- cita would find no conflicting row in the index. The trigger below
-- closes that gap.
alter table public.appointments
  drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at) with &&)
  where (status in ('por_confirmar', 'pendiente', 'confirmada')
         and not manual_override);

-- Trigger: a non-override active cita may not overlap ANY active cita,
-- override or not. Override rows skip the check but still take the
-- per-date advisory lock, so a normal insert racing an override insert
-- cannot slip through between check and commit. Raises 23P01, so every
-- caller keeps mapping it to "slot_taken" exactly as before.
-- SECURITY DEFINER: the overlap check must see every row on the date
-- regardless of the caller's RLS policy (same pattern as
-- create_booking). The range is computed from date/start_time/duration
-- with the same formula as set_appointment_range, so this trigger does
-- not depend on trigger firing order.
create or replace function public.check_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starts timestamptz;
  v_ends timestamptz;
begin
  -- Only active rows participate in overlap enforcement.
  if NEW.status not in ('por_confirmar', 'pendiente', 'confirmada') then
    return NEW;
  end if;

  -- Serialize same-date appointment writes for the transaction.
  perform pg_advisory_xact_lock(hashtext('appt-overlap:' || NEW.date::text)::bigint);

  -- Override rows are exempt from the check itself.
  if NEW.manual_override then
    return NEW;
  end if;

  -- Skip the re-check when neither the range nor the flag changed
  -- (confirming a hold, marking paid, a no-op move): the row was
  -- already validated, and an override stacked on top of it must not
  -- block those operations.
  if TG_OP = 'UPDATE' then
    if OLD.date = NEW.date
       and OLD.start_time = NEW.start_time
       and OLD.duration_minutes = NEW.duration_minutes
       and OLD.manual_override = NEW.manual_override then
      return NEW;
    end if;
  end if;

  v_starts := (NEW.date + NEW.start_time) at time zone 'America/Santo_Domingo';
  v_ends := v_starts + make_interval(mins => NEW.duration_minutes);

  if exists (
    select 1
    from public.appointments a
    where a.id <> coalesce(OLD.id, '00000000-0000-0000-0000-000000000000')
      and a.date = NEW.date
      and a.status in ('por_confirmar', 'pendiente', 'confirmada')
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_starts, v_ends)
  ) then
    raise exception 'appointment overlaps an active appointment'
      using errcode = '23P01';
  end if;

  return NEW;
end;
$$;

drop trigger if exists appointments_overlap_check on public.appointments;
create trigger appointments_overlap_check
  before insert or update of date, start_time, duration_minutes, status, manual_override
  on public.appointments
  for each row execute function public.check_appointment_overlap();

-- ----------------------------------------------------------------------
-- Verification (paste into the SQL Editor AFTER applying the migration
-- above; the whole block rolls back, so no test data stays behind).
-- Expected: the two override inserts succeed, the normal insert into
-- the same time fails with 23P01, and the final count is unchanged.
-- ----------------------------------------------------------------------
-- begin;
-- -- A: normal cita, far-future date, no conflicts.
-- insert into public.appointments
--   (reference_code, guest_name, guest_email, date, start_time,
--    duration_minutes, total_price, status, source)
-- values ('CH-TEST01', 'Prueba Solape', 'prueba@example.com',
--         '2030-01-07', '10:00', 30, 0, 'confirmada', 'presencial');
-- -- B: override cita at the SAME time — must succeed.
-- insert into public.appointments
--   (reference_code, guest_name, guest_email, date, start_time,
--    duration_minutes, total_price, status, source, manual_override)
-- values ('CH-TEST02', 'Prueba Solape', 'prueba@example.com',
--         '2030-01-07', '10:00', 30, 0, 'confirmada', 'presencial', true);
-- -- C: second override at the same time — must succeed.
-- insert into public.appointments
--   (reference_code, guest_name, guest_email, date, start_time,
--    duration_minutes, total_price, status, source, manual_override)
-- values ('CH-TEST03', 'Prueba Solape', 'prueba@example.com',
--         '2030-01-07', '10:15', 30, 0, 'confirmada', 'presencial', true);
-- -- D: normal cita overlapping the override rows — must FAIL 23P01.
-- -- (Run D in its own block: the error aborts the transaction.)
-- rollback;
