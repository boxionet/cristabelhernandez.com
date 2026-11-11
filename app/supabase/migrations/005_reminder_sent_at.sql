-- 005: 24-hour reminder tracking (Phase 6).
-- booking-reminders (hourly) emails patients ~24h before their
-- appointment and stamps this column so each cita is reminded once.
alter table public.appointments
  add column if not exists reminder_sent_at timestamptz;
