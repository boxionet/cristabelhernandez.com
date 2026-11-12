-- Phase 4 reminder-filter seeds (2026-11-12). Run in the Supabase
-- SQL Editor. Delete-first so a re-run is safe.
-- Timing: the reminders function emails confirmada citas starting
-- 23-25h from the run. These seeds sit at 13:00 / 13:30 AST on
-- Fri Nov 13 (17:00 / 17:30 UTC), so the manual POST must run
-- between 11:30 AM and 1:00 PM EST on Thu Nov 12.
-- Expected POST result: {checked: 1, sent: 1} (only the confirmada
-- seed; the pendiente seed proves the status filter). A second run
-- must return {checked: 0, sent: 0}. Cleanup deletes both by ref.

-- Baseline (report these numbers before seeding):
select status, count(*) from public.appointments group by status order by status;
select reference_code, status, date, start_time from public.appointments
  where reference_code in ('CH-8EU3PM','CH-WNMCZU','CH-X8BFX4') order by date;
select date, is_closed, label from public.date_exceptions;
select count(*) as patients from public.patients;

delete from public.appointments
  where reference_code in ('CH-RM4TST','CH-RM4PND');

with p_user as (
  select id from public.patients where lower(email) = 'mr.luiscastillo@gmail.com' limit 1
),
p_prueba as (
  select id from public.patients where lower(email) = 'mr.luiscastillo+perfil@gmail.com' limit 1
),
s as (
  select id, name, price from public.services where slug = 'toxina-frontal' limit 1
),
a1 as (
  insert into public.appointments
    (reference_code, patient_id, date, start_time, duration_minutes,
     total_price, total_is_estimate, status, source)
  select 'CH-RM4TST', (select id from p_user), '2026-11-13', '13:00', 30,
         (select price from s), false, 'confirmada', 'telefono'
  returning id
),
a2 as (
  insert into public.appointments
    (reference_code, patient_id, date, start_time, duration_minutes,
     total_price, total_is_estimate, status, source)
  select 'CH-RM4PND', (select id from p_prueba), '2026-11-13', '13:30', 30,
         (select price from s), false, 'pendiente', 'telefono'
  returning id
)
insert into public.appointment_services
  (appointment_id, service_id, service_name, unit_price, quantity, price_from, price_note)
select (select id from a1), (select id from s), (select name from s),
       (select price from s), 1, false, null
union all
select (select id from a2), (select id from s), (select name from s),
       (select price from s), 1, false, null;

select reference_code, status, date, start_time, starts_at, reminder_sent_at
  from public.appointments
  where reference_code in ('CH-RM4TST','CH-RM4PND') order by start_time;
