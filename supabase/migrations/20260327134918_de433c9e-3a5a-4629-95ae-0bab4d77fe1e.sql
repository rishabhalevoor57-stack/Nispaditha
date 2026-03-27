-- Drop the unique constraint on SKU to allow duplicates for Necklace Sets
-- Validation will be handled in application code
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;