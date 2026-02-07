-- Remove the old hardcoded check constraint on type_of_work
-- Now type_of_work values come from the types_of_work master table
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_type_of_work_check;