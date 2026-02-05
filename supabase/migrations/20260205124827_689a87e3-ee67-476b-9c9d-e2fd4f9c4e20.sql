-- Add new columns to products table for enhanced inventory management
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS type_of_work text DEFAULT 'Others',
ADD COLUMN IF NOT EXISTS bangle_size text,
ADD COLUMN IF NOT EXISTS date_ordered date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS price_per_gram numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_stock',
ADD COLUMN IF NOT EXISTS mrp numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS description text;

-- Add constraint for type_of_work
ALTER TABLE public.products 
ADD CONSTRAINT products_type_of_work_check 
CHECK (type_of_work IN ('Casting', 'Handmade', 'Polishing', 'Repair', 'Custom', 'Others'));

-- Add constraint for status
ALTER TABLE public.products 
ADD CONSTRAINT products_status_check 
CHECK (status IN ('sold', 'in_stock', 'for_repair'));

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('product-images', 'product-images', true, 31457280)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');