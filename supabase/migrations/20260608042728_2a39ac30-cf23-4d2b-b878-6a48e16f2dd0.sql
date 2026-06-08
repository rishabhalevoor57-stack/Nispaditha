ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_to_name text,
  ADD COLUMN IF NOT EXISTS paid_to_phone text;