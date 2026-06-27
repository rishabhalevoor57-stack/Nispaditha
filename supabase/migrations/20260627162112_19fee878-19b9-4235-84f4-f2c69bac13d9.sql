
-- Melting module
CREATE TABLE IF NOT EXISTS public.melting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  melting_number text UNIQUE NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vendor_name text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name text,
  source_type text NOT NULL DEFAULT 'other',
  source_reference_id uuid,
  source_reference_label text,
  description text,
  metal_type text NOT NULL DEFAULT 'silver',
  gross_weight numeric NOT NULL DEFAULT 0,
  avg_purity numeric NOT NULL DEFAULT 92.5,
  fine_weight numeric NOT NULL DEFAULT 0,
  melting_loss_percent numeric NOT NULL DEFAULT 0,
  recovered_weight numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  inventory_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  inventory_sku text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.melting_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  melting_id uuid NOT NULL REFERENCES public.melting_entries(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  gross_weight numeric NOT NULL DEFAULT 0,
  purity numeric NOT NULL DEFAULT 92.5,
  fine_weight numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.melting_entries TO authenticated;
GRANT ALL ON public.melting_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.melting_items TO authenticated;
GRANT ALL ON public.melting_items TO service_role;

ALTER TABLE public.melting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.melting_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view melting" ON public.melting_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert melting" ON public.melting_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update melting" ON public.melting_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin can delete melting" ON public.melting_entries FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Auth can view melting items" ON public.melting_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert melting items" ON public.melting_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update melting items" ON public.melting_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete melting items" ON public.melting_items FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_melting_status ON public.melting_entries(status);
CREATE INDEX IF NOT EXISTS idx_melting_date ON public.melting_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_melting_items_parent ON public.melting_items(melting_id);

CREATE TRIGGER trg_melting_entries_updated_at
  BEFORE UPDATE ON public.melting_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Number generator
CREATE OR REPLACE FUNCTION public.generate_melting_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_num integer; n text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(melting_number FROM 6) AS integer)), 0) + 1
    INTO next_num FROM public.melting_entries WHERE melting_number LIKE 'MELT-%';
  n := 'MELT-' || LPAD(next_num::text, 5, '0');
  RETURN n;
END;$$;

-- Send-to-inventory RPC: creates product with MLT SKU and links it
CREATE OR REPLACE FUNCTION public.send_melting_to_inventory(
  p_melting_id uuid,
  p_product_name text DEFAULT NULL,
  p_price_per_gram numeric DEFAULT 0,
  p_making_charges numeric DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.melting_entries%ROWTYPE;
  v_sku text;
  v_prefix text;
  v_next integer;
  v_product_id uuid;
  v_name text;
  v_category_id uuid;
BEGIN
  SELECT * INTO v_entry FROM public.melting_entries WHERE id = p_melting_id;
  IF v_entry.id IS NULL THEN RAISE EXCEPTION 'Melting entry not found'; END IF;
  IF v_entry.inventory_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already sent to inventory';
  END IF;

  v_prefix := 'MLT' || UPPER(LEFT(COALESCE(v_entry.metal_type,'SIL'),3));
  SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(SUBSTRING(sku FROM LENGTH(v_prefix)+1), '[^0-9]', '', 'g'),'') AS integer)), 0) + 1
    INTO v_next FROM public.products WHERE sku LIKE v_prefix || '%';
  v_sku := v_prefix || LPAD(v_next::text, 3, '0');

  SELECT id INTO v_category_id FROM public.categories WHERE LOWER(name) = 'refined metal' LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO public.categories (name) VALUES ('Refined Metal') RETURNING id INTO v_category_id;
  END IF;

  v_name := COALESCE(NULLIF(p_product_name,''), 'Refined ' || INITCAP(v_entry.metal_type));

  INSERT INTO public.products (
    sku, name, description, category_id, metal_type, purity,
    weight_grams, quantity, price_per_gram, making_charges,
    gst_percentage, status, pricing_mode, mrp, low_stock_alert
  ) VALUES (
    v_sku, v_name,
    'Auto-created from melting ' || v_entry.melting_number,
    v_category_id, v_entry.metal_type, v_entry.avg_purity::text,
    v_entry.recovered_weight, 1, COALESCE(p_price_per_gram,0), COALESCE(p_making_charges,0),
    3, 'in_stock', 'weight_based',
    v_entry.recovered_weight * COALESCE(p_price_per_gram,0) + COALESCE(p_making_charges,0),
    1
  ) RETURNING id INTO v_product_id;

  UPDATE public.melting_entries
    SET inventory_product_id = v_product_id,
        inventory_sku = v_sku,
        status = 'completed'
    WHERE id = p_melting_id;

  INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
  VALUES (v_product_id, 1, 'in', 'Created from melting ' || v_entry.melting_number, p_melting_id, auth.uid());

  RETURN v_product_id;
END;$$;
