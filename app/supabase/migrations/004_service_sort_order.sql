-- 004: services.sort_order must be globally unique for ordering.
-- The 002 seed numbered each category from 1 (facial 1-9, corporal
-- 1-4), so ORDER BY sort_order interleaved the categories. Facial
-- keeps 1-9; corporal moves to 10-13.
update public.services set sort_order = sort_order + 9 where category = 'corporal';
