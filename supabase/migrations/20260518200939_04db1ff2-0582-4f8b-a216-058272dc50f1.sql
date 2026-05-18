
-- Clamp existing negative inventory to zero
UPDATE public.products SET quantity = 0 WHERE quantity < 0;
UPDATE public.product_store_quantities SET quantity = 0 WHERE quantity < 0;

-- Prevent negative stock going forward
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS qty_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT qty_non_negative CHECK (quantity >= 0);

ALTER TABLE public.product_store_quantities
  DROP CONSTRAINT IF EXISTS psq_qty_non_negative;
ALTER TABLE public.product_store_quantities
  ADD CONSTRAINT psq_qty_non_negative CHECK (quantity >= 0);

-- Metal buyback has no original invoice — make this column nullable
ALTER TABLE public.return_exchanges
  ALTER COLUMN original_invoice_id DROP NOT NULL,
  ALTER COLUMN original_invoice_number DROP NOT NULL;
