
-- Add image_url column to order_note_items
ALTER TABLE public.order_note_items ADD COLUMN image_url text DEFAULT NULL;

-- Create storage bucket for order note images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-note-images', 'order-note-images', true, 104857600);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload order note images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-note-images');

-- Allow public read access
CREATE POLICY "Anyone can view order note images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'order-note-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete order note images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-note-images');
