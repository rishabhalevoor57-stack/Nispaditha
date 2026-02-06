
-- Add pricing_mode column to products table
ALTER TABLE public.products 
ADD COLUMN pricing_mode text NOT NULL DEFAULT 'weight_based';

-- Add comment for clarity
COMMENT ON COLUMN public.products.pricing_mode IS 'Either weight_based or flat_price';
