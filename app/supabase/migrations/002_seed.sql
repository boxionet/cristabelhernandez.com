-- =====================================================================
-- Seed data (Phase 1) — mirrors the live booking flow exactly:
-- catalog from src/assets/js/booking-services.js, categories from the
-- /reservar/servicios/ sections, schedule from booking-date-time.js
-- rules (weekends blocked) and the live slot grid (9:00 AM first slot,
-- 5:00 PM last start; +60 min max service => 6:00 PM close).
--
-- The Dra can change all of this later in Panel -> Tratamientos/Horario.
-- Safe to re-run: inserts are conflict-guarded.
-- =====================================================================

insert into public.services
  (slug, name, category, price, price_from, price_note, duration_minutes, sort_order)
values
  ('toxina-frontal',        'Toxina Botulínica Frontal',    'facial',   13000, false, null,         30, 1),
  ('toxina-full-face',      'Toxina Botulínica Full Face',  'facial',   18000, false, null,         40, 2),
  ('microneedling',         'Microneedling',                'facial',    3500, true,  null,         45, 3),
  ('mesoterapia-facial',    'Mesoterapia Facial',           'facial',    4000, true,  null,         45, 4),
  ('prp-facial',            'Plasma Rico en Plaquetas Facial', 'facial', 8000, false, null,         60, 5),
  ('peelings-quimicos',     'Peelings Químicos',            'facial',    4000, true,  null,         60, 6),
  ('rejuvenecimiento-cuello', 'Rejuvenecimiento de Cuello', 'facial',    9000, true,  null,         60, 7),
  ('rejuvenecimiento-escote', 'Rejuvenecimiento de Escote', 'facial',    9000, true,  null,         60, 8),
  ('rejuvenecimiento-manos',  'Rejuvenecimiento de Manos',  'facial',    9000, true,  null,         60, 9),
  ('escleroterapia',        'Escleroterapia',               'corporal',  3500, true,  null,         40, 1),
  ('lipolisis-menton',      'Lipólisis de Mentón',          'corporal', 28000, false, '3 sesiones', 45, 2),
  ('lipolisis-localizada',  'Lipólisis Localizada (Aqualyx)', 'corporal', 7000, false, 'c/ampolla', 45, 3),
  ('anticelulitico-alidya', 'Anticelulítico (Alidya)',      'corporal',  4500, false, 'c/ampolla', 45, 4)
on conflict (slug) do nothing;

-- Weekly schedule: Mon–Fri open 9:00–18:00; Sat/Sun closed
-- (weekday: 0 = Sunday … 6 = Saturday).
insert into public.weekly_schedule (weekday, is_open, open_time, close_time)
values
  (0, false, '09:00', '18:00'),  -- Sunday
  (1, true,  '09:00', '18:00'),  -- Monday
  (2, true,  '09:00', '18:00'),  -- Tuesday
  (3, true,  '09:00', '18:00'),  -- Wednesday
  (4, true,  '09:00', '18:00'),  -- Thursday
  (5, true,  '09:00', '18:00'),  -- Friday
  (6, false, '09:00', '18:00')   -- Saturday
on conflict (weekday) do nothing;
