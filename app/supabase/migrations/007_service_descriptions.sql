-- =====================================================================
-- 007_service_descriptions.sql — backfill services.description
-- =====================================================================
-- The description column exists since migration 001, but the seed
-- (002) never filled it and the Panel form never exposed it, so all
-- 13 rows are NULL and the booking cards render their lines from a
-- hardcoded frontend map (SERVICE_DESCRIPTIONS). This backfill
-- copies those exact lines into the database so services.description
-- becomes the single source of truth; the frontend map remains only
-- as a fallback for rows whose description is empty.
--
-- Apply once in the Supabase SQL Editor (paste + Run). Idempotent:
-- re-running it sets the same values again. Run AFTER the code that
-- reads services.description ships (or before — the column has
-- existed since 001, so no code depends on these values being set).
-- =====================================================================

update public.services set description = 'Suaviza líneas de expresión y arrugas dinámicas' where slug = 'toxina-frontal';
update public.services set description = 'Suaviza líneas de expresión y arrugas dinámicas' where slug = 'toxina-full-face';
update public.services set description = 'Estimula colágeno para mejorar textura y luminosidad' where slug = 'microneedling';
update public.services set description = 'Plasma rico en plaquetas para rejuvenecimiento' where slug = 'prp-facial';
update public.services set description = 'Tratamiento de arañitas vasculares' where slug = 'escleroterapia';
update public.services set description = 'Microinyecciones con principios activos para mejorar la hidratación y la calidad de la piel' where slug = 'mesoterapia-facial';
update public.services set description = 'Exfoliación médica para renovar la piel' where slug = 'peelings-quimicos';
update public.services set description = 'Reduce pequeños depósitos de grasa localizada en el mentón' where slug = 'lipolisis-menton';
update public.services set description = 'Reduce grasa localizada en diferentes zonas del cuerpo, mejorando el contorno corporal de forma no quirúrgica' where slug = 'lipolisis-localizada';
update public.services set description = 'Inyectable diseñado para mejorar la apariencia de la celulitis, favoreciendo una piel más lisa, firme y uniforme' where slug = 'anticelulitico-alidya';
update public.services set description = 'Tratamiento personalizado según valoración médica' where slug = 'rejuvenecimiento-cuello';
update public.services set description = 'Mejora textura y firmeza de la zona del escote' where slug = 'rejuvenecimiento-escote';
update public.services set description = 'Devuelve juventud y volumen a las manos' where slug = 'rejuvenecimiento-manos';

-- Verify: expect 13 rows, none with a NULL description.
select slug, name, description from public.services order by sort_order;
