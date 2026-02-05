-- Add purchase price calculation columns
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS purchase_price_per_gram numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchase_making_charges numeric DEFAULT 0;