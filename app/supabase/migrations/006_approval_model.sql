-- =====================================================================
-- 006 — Approval model (2026-11-11, owner-approved).
--
-- The clinic approves every online booking: web holds confirmed through
-- the email link land in 'pendiente' (awaiting the Dra's approval in
-- Citas), NOT in a confirmed state. Staff-created holds (source
-- telefono/whatsapp/presencial — the Dra already decided by creating
-- them) resolve straight to 'confirmada' when the patient clicks the
-- link. Panel staff actions (confirmHold) are the approval itself.
--
-- confirm_booking also handles holds that are already linked to a
-- patient row (manual bookings with an email carry patient_id and no
-- guest_* fields): the link is kept, no duplicate patient is created.
-- =====================================================================

create or replace function public.confirm_booking(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt       public.appointments;
  v_patient_id uuid;
  v_status     text;
begin
  select * into v_appt
    from public.appointments
   where confirmation_token = p_token
     for update;

  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;

  if v_appt.confirmation_expires_at is not null
     and v_appt.confirmation_expires_at < now() then
    delete from public.appointments where id = v_appt.id;
    return jsonb_build_object('result', 'expired');
  end if;

  -- Already linked (manual booking with an email): keep the patient.
  -- Guest hold: find-or-create by the verified guest email.
  if v_appt.patient_id is not null then
    v_patient_id := v_appt.patient_id;
  elsif v_appt.guest_email is not null then
    select id into v_patient_id
      from public.patients
     where lower(email) = lower(v_appt.guest_email);

    if v_patient_id is null then
      insert into public.patients (full_name, email, phone)
      values (v_appt.guest_name, v_appt.guest_email, v_appt.guest_phone)
      returning id into v_patient_id;
    end if;
  end if;

  -- Web bookings wait for the Dra's approval; staff-created bookings
  -- were already decided when the Dra created them.
  v_status := case when v_appt.source = 'web' then 'pendiente' else 'confirmada' end;

  update public.appointments
     set patient_id = v_patient_id,
         status = v_status,
         confirmation_token = null,
         confirmation_expires_at = null,
         guest_name = null, guest_email = null, guest_phone = null
   where id = v_appt.id
  returning * into v_appt;

  return jsonb_build_object(
    'result', 'confirmed',
    'status', v_status,
    'appointment', to_jsonb(v_appt)
  );
end;
$$;
