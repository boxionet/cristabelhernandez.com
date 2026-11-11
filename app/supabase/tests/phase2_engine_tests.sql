-- =====================================================================
-- Phase 2 engine tests — run in the Supabase SQL Editor AFTER
-- 003_booking_functions.sql. Run the blocks in order and compare each
-- result with the "expect" note. The script cleans up after itself.
-- =====================================================================

-- TEST 1: guest booking -> por_confirmar hold, totals from the catalog
-- (Toxina Frontal 13,000 + Microneedling 3,500 = 16,500; 30 + 45 = 75 min)
select reference_code, status, total_price, duration_minutes,
       confirmation_token is not null as has_token,
       confirmation_expires_at > now() as expiry_in_future,
       patient_id is null as no_patient_yet
from public.create_booking(
  '[{"slug":"toxina-frontal","quantity":1},{"slug":"microneedling","quantity":1}]'::jsonb,
  '2026-11-16', '10:00', 'Paciente Prueba', 'prueba@example.com', '8095550100',
  false, null, 'test-key-001');
-- expect: status = por_confirmar, total_price = 16500, duration = 75,
--         has_token = true, expiry_in_future = true, no_patient_yet = true

-- TEST 2: idempotent replay — same key, different payload, same booking
select reference_code
from public.create_booking(
  '[{"slug":"toxina-frontal","quantity":1}]'::jsonb,
  '2026-11-17', '09:00', 'Otro Nombre', 'otro@example.com', null,
  false, null, 'test-key-001');
-- expect: the SAME reference_code as Test 1

select count(*) as rows_with_test_key
from public.appointments where idempotency_key = 'test-key-001';
-- expect: 1

-- TEST 3: an overlapping booking must be rejected by the database
do $$
begin
  perform public.create_booking(
    '[{"slug":"prp-facial","quantity":1}]'::jsonb,
    '2026-11-16', '10:30', 'Choque', 'choque@example.com', null,
    false, null, 'test-key-002');
  raise exception 'OVERLAP_NOT_BLOCKED';
exception when exclusion_violation then
  raise notice 'overlap correctly blocked';
end $$;
-- expect: notice "overlap correctly blocked" (NOT the OVERLAP_NOT_BLOCKED error)

-- TEST 4: confirming the guest link creates the patient and books her
select public.confirm_booking(
  (select confirmation_token from public.appointments
   where idempotency_key = 'test-key-001')) ->> 'result' as confirm_result;
-- expect: confirmed

select count(*) as patients_created
from public.patients where email = 'prueba@example.com';
-- expect: 1

select status, patient_id is not null as linked, confirmation_token is null as token_cleared
from public.appointments where idempotency_key = 'test-key-001';
-- expect: status = pendiente, linked = true, token_cleared = true

-- TEST 5: a verified booking with the same email matches that patient
select status, patient_id is not null as linked
from public.create_booking(
  '[{"slug":"peelings-quimicos","quantity":1}]'::jsonb,
  '2026-11-18', '09:00', 'Paciente Prueba', 'prueba@example.com', null,
  true, null, 'test-key-003');
-- expect: status = pendiente, linked = true

select count(*) as patient_rows_for_email
from public.patients where lower(email) = 'prueba@example.com';
-- expect: 1 (matched, not duplicated)

-- TEST 6: expired holds are purged and their slot is released
insert into public.appointments (
  reference_code, guest_name, guest_email, date, start_time,
  duration_minutes, total_price, status, confirmation_token,
  confirmation_expires_at)
values (
  'CH-TESTX', 'Expira', 'expira@example.com', '2026-11-19', '09:00',
  30, 1000, 'por_confirmar', gen_random_uuid(), now() - interval '1 hour');

select public.purge_expired_holds() as purged;
-- expect: purged >= 1

select count(*) as expired_left
from public.appointments where reference_code = 'CH-TESTX';
-- expect: 0

-- CLEANUP: remove every test row
delete from public.appointments
where idempotency_key in ('test-key-001', 'test-key-002', 'test-key-003');
delete from public.patients
where email in ('prueba@example.com', 'otro@example.com',
                'choque@example.com', 'expira@example.com');

select (select count(*) from public.appointments) as appointments_left,
       (select count(*) from public.patients) as patients_left;
-- expect: 0 and 0 (the database returns to its clean Phase 1 state)
