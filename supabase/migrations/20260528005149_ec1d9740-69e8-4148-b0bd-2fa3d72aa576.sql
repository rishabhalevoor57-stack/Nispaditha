
-- CHANGE 1: Custom Order Components + editable GST
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS gst_percentage numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS components_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS components_weight numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.custom_order_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_order_id uuid NOT NULL,
  component_name text NOT NULL,
  material text,
  weight_grams numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  rate_per_gram numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_order_components TO authenticated;
GRANT ALL ON public.custom_order_components TO service_role;

ALTER TABLE public.custom_order_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom order components"
ON public.custom_order_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert custom order components"
ON public.custom_order_components FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update custom order components"
ON public.custom_order_components FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete custom order components"
ON public.custom_order_components FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_custom_order_components_order_id
  ON public.custom_order_components(custom_order_id);


-- CHANGE 2: Service Forms
CREATE TABLE IF NOT EXISTS public.service_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  client_id uuid,
  client_name text NOT NULL,
  client_phone text,
  item_description text NOT NULL,
  from_our_shop boolean NOT NULL DEFAULT false,
  original_invoice_no text,
  material text,
  weight_grams numeric NOT NULL DEFAULT 0,
  condition_on_receipt text,
  photo_url text,
  service_types text[] NOT NULL DEFAULT '{}',
  other_service_text text,
  service_notes text,
  estimated_delivery_date date,
  estimated_cost numeric NOT NULL DEFAULT 0,
  final_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received',
  completed_invoice_id uuid,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_forms TO authenticated;
GRANT ALL ON public.service_forms TO service_role;

ALTER TABLE public.service_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service forms"
ON public.service_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service forms"
ON public.service_forms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update service forms"
ON public.service_forms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete service forms"
ON public.service_forms FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER update_service_forms_updated_at
BEFORE UPDATE ON public.service_forms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_service_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num integer;
  receipt_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.service_forms
  WHERE receipt_number LIKE 'SVC-%';

  receipt_num := 'SVC-' || LPAD(next_num::text, 6, '0');
  RETURN receipt_num;
END;
$$;

-- Storage bucket for service form photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-form-images', 'service-form-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view service form images"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-form-images');

CREATE POLICY "Authenticated can upload service form images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-form-images');

CREATE POLICY "Authenticated can update service form images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'service-form-images');

CREATE POLICY "Authenticated can delete service form images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-form-images');
