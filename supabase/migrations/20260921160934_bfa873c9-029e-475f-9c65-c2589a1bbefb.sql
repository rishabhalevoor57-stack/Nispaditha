ALTER TABLE public.custom_order_components
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

UPDATE public.custom_order_components
SET discount_value = COALESCE(discount_value, 0),
    discount_type = COALESCE(NULLIF(discount_type, ''), 'fixed'),
    discount = COALESCE(discount, 0);