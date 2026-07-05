
-- ============================================================
-- 1. CATEGORY CONSOLIDATION: Beads / "Beads    Pearls" -> Beads & Pearls
-- ============================================================
DO $$
DECLARE
  v_bp_id uuid;
  v_beads_id uuid;
  v_broken_id uuid;
BEGIN
  SELECT id INTO v_bp_id FROM public.categories WHERE lower(name) = 'beads & pearls' LIMIT 1;
  SELECT id INTO v_beads_id FROM public.categories WHERE lower(name) = 'beads' LIMIT 1;
  SELECT id INTO v_broken_id FROM public.categories WHERE name ILIKE 'Beads%Pearls' AND id <> COALESCE(v_bp_id, '00000000-0000-0000-0000-000000000000'::uuid) LIMIT 1;

  IF v_bp_id IS NULL THEN
    IF v_broken_id IS NOT NULL THEN
      UPDATE public.categories SET name = 'Beads & Pearls' WHERE id = v_broken_id;
      v_bp_id := v_broken_id;
      v_broken_id := NULL;
    ELSE
      INSERT INTO public.categories (name) VALUES ('Beads & Pearls') RETURNING id INTO v_bp_id;
    END IF;
  END IF;

  IF v_broken_id IS NOT NULL AND v_broken_id <> v_bp_id THEN
    UPDATE public.products SET category_id = v_bp_id WHERE category_id = v_broken_id;
    DELETE FROM public.categories WHERE id = v_broken_id;
  END IF;

  IF v_beads_id IS NOT NULL AND v_beads_id <> v_bp_id THEN
    UPDATE public.products SET category_id = v_bp_id WHERE category_id = v_beads_id;
    DELETE FROM public.categories WHERE id = v_beads_id;
  END IF;
END $$;

-- ============================================================
-- 2. PRODUCTS: strings_count, is_list_price, date_of_making
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS strings_count numeric(10,2),
  ADD COLUMN IF NOT EXISTS is_list_price boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_making date;

-- ============================================================
-- 3. CUSTOM ORDERS: order_type + product details for in-house
-- ============================================================
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS product_sku text,
  ADD COLUMN IF NOT EXISTS product_title text,
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS product_date_of_making date,
  ADD COLUMN IF NOT EXISTS product_vendor_id uuid,
  ADD COLUMN IF NOT EXISTS product_buying_price numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_selling_price numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_selling_price_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_category_id uuid,
  ADD COLUMN IF NOT EXISTS product_image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory_product_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'custom_orders_order_type_chk') THEN
    ALTER TABLE public.custom_orders ADD CONSTRAINT custom_orders_order_type_chk CHECK (order_type IN ('customer','in_house'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_orders_vendor_fkey') THEN
    ALTER TABLE public.custom_orders ADD CONSTRAINT custom_orders_vendor_fkey FOREIGN KEY (product_vendor_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_orders_category_fkey') THEN
    ALTER TABLE public.custom_orders ADD CONSTRAINT custom_orders_category_fkey FOREIGN KEY (product_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'custom_orders_inventory_product_fkey') THEN
    ALTER TABLE public.custom_orders ADD CONSTRAINT custom_orders_inventory_product_fkey FOREIGN KEY (inventory_product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. CUSTOM ORDER ITEMS: strings_used
-- ============================================================
ALTER TABLE public.custom_order_items
  ADD COLUMN IF NOT EXISTS strings_used numeric(10,2);

-- ============================================================
-- 5. BRANCH STOCK TRANSFERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branch_stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text,
  product_name text,
  from_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  to_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  transfer_date timestamptz NOT NULL DEFAULT now(),
  remarks text,
  status text NOT NULL DEFAULT 'completed',
  destination_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  transferred_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_stock_transfers TO authenticated;
GRANT ALL ON public.branch_stock_transfers TO service_role;

ALTER TABLE public.branch_stock_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View branch transfers" ON public.branch_stock_transfers;
CREATE POLICY "View branch transfers" ON public.branch_stock_transfers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Create branch transfers" ON public.branch_stock_transfers;
CREATE POLICY "Create branch transfers" ON public.branch_stock_transfers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins update branch transfers" ON public.branch_stock_transfers;
CREATE POLICY "Admins update branch transfers" ON public.branch_stock_transfers
  FOR UPDATE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins delete branch transfers" ON public.branch_stock_transfers;
CREATE POLICY "Admins delete branch transfers" ON public.branch_stock_transfers
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_bst_product ON public.branch_stock_transfers(product_id);
CREATE INDEX IF NOT EXISTS idx_bst_from ON public.branch_stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_bst_to ON public.branch_stock_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_bst_sku ON public.branch_stock_transfers(sku);
CREATE INDEX IF NOT EXISTS idx_bst_dest_product ON public.branch_stock_transfers(destination_product_id);

-- ============================================================
-- 6. RPC: transfer_product_to_branch
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_product_to_branch(
  p_product_id uuid,
  p_to_branch_id uuid,
  p_quantity integer,
  p_transfer_date timestamptz DEFAULT now(),
  p_remarks text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.products%ROWTYPE;
  v_dest_id uuid;
  v_from_branch uuid;
  v_transfer_id uuid;
  v_from_name text;
  v_to_name text;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Transfer quantity must be at least 1';
  END IF;
  IF p_to_branch_id IS NULL THEN
    RAISE EXCEPTION 'Destination branch is required';
  END IF;

  SELECT * INTO v_source FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF v_source.id IS NULL THEN RAISE EXCEPTION 'Source product not found'; END IF;
  IF COALESCE(v_source.quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, requested: %', COALESCE(v_source.quantity, 0), p_quantity;
  END IF;

  v_from_branch := v_source.branch_id;
  IF v_from_branch IS NULL THEN
    SELECT id INTO v_from_branch FROM public.branches WHERE is_default LIMIT 1;
  END IF;
  IF v_from_branch = p_to_branch_id THEN
    RAISE EXCEPTION 'Source and destination branch must be different';
  END IF;

  SELECT name INTO v_from_name FROM public.branches WHERE id = v_from_branch;
  SELECT name INTO v_to_name   FROM public.branches WHERE id = p_to_branch_id;

  SELECT id INTO v_dest_id
    FROM public.products
    WHERE sku = v_source.sku AND branch_id = p_to_branch_id AND deleted_at IS NULL
    LIMIT 1;

  IF v_dest_id IS NOT NULL THEN
    UPDATE public.products
      SET quantity = quantity + p_quantity, updated_at = now()
      WHERE id = v_dest_id;
  ELSE
    INSERT INTO public.products (
      sku, name, description, category_id, metal_type, purity, weight_grams,
      quantity, purchase_price, selling_price, making_charges, supplier_id,
      gst_percentage, low_stock_alert, image_url, type_of_work, bangle_size,
      date_ordered, price_per_gram, status, mrp, purchase_price_per_gram,
      purchase_making_charges, pricing_mode, branch_id, is_list_price,
      date_of_making, strings_count
    ) VALUES (
      v_source.sku, v_source.name, v_source.description, v_source.category_id,
      v_source.metal_type, v_source.purity, v_source.weight_grams, p_quantity,
      v_source.purchase_price, v_source.selling_price, v_source.making_charges,
      v_source.supplier_id, v_source.gst_percentage, v_source.low_stock_alert,
      v_source.image_url, v_source.type_of_work, v_source.bangle_size,
      v_source.date_ordered, v_source.price_per_gram, v_source.status, v_source.mrp,
      v_source.purchase_price_per_gram, v_source.purchase_making_charges,
      v_source.pricing_mode, p_to_branch_id, v_source.is_list_price,
      v_source.date_of_making, v_source.strings_count
    ) RETURNING id INTO v_dest_id;
  END IF;

  UPDATE public.products
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE id = p_product_id;

  INSERT INTO public.branch_stock_transfers (
    product_id, sku, product_name, from_branch_id, to_branch_id, quantity,
    transfer_date, remarks, status, destination_product_id, transferred_by
  ) VALUES (
    p_product_id, v_source.sku, v_source.name, v_from_branch, p_to_branch_id,
    p_quantity, COALESCE(p_transfer_date, now()), p_remarks, 'completed', v_dest_id, auth.uid()
  ) RETURNING id INTO v_transfer_id;

  INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
  VALUES (p_product_id, -p_quantity, 'transfer_out',
    'Branch transfer to ' || COALESCE(v_to_name, 'Unknown'), v_transfer_id, auth.uid());
  INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
  VALUES (v_dest_id, p_quantity, 'transfer_in',
    'Branch transfer from ' || COALESCE(v_from_name, 'Unknown'), v_transfer_id, auth.uid());

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'destination_product_id', v_dest_id,
    'from_branch', v_from_name,
    'to_branch', v_to_name
  );
END;
$$;

-- ============================================================
-- 7. RPC: send_custom_order_to_inventory
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_custom_order_to_inventory(
  p_custom_order_id uuid,
  p_final_quantity integer DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_product_id uuid;
  v_sku text;
  v_main_branch uuid;
  v_qty integer;
  v_first_image text;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_custom_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Custom order not found'; END IF;
  IF v_order.order_type <> 'in_house' THEN RAISE EXCEPTION 'Only in-house orders can be sent to inventory'; END IF;
  IF v_order.inventory_product_id IS NOT NULL THEN RAISE EXCEPTION 'This order has already been sent to inventory'; END IF;

  v_qty := GREATEST(1, COALESCE(p_final_quantity, 1));
  v_sku := COALESCE(NULLIF(TRIM(v_order.product_sku),''), 'IH-' || REPLACE(v_order.reference_number, 'CO-', ''));

  IF EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SKU % already exists in inventory. Choose a different SKU.', v_sku;
  END IF;

  SELECT id INTO v_main_branch FROM public.branches WHERE is_default LIMIT 1;
  v_first_image := (v_order.product_image_urls->>0);

  INSERT INTO public.products (
    sku, name, description, category_id, weight_grams, quantity,
    purchase_price, selling_price, making_charges, gst_percentage,
    low_stock_alert, supplier_id, type_of_work, status, mrp,
    pricing_mode, is_list_price, date_of_making, date_ordered,
    branch_id, image_url
  ) VALUES (
    v_sku,
    COALESCE(NULLIF(TRIM(v_order.product_title),''), 'Custom Order ' || v_order.reference_number),
    v_order.product_description,
    v_order.product_category_id,
    COALESCE(v_order.components_weight, 0),
    v_qty,
    COALESCE(v_order.product_buying_price, 0),
    COALESCE(v_order.product_selling_price, 0),
    0,
    COALESCE(v_order.gst_percentage, 3),
    1,
    v_order.product_vendor_id,
    'Others',
    'in_stock',
    COALESCE(v_order.product_selling_price, 0),
    'flat_price',
    true,
    COALESCE(v_order.product_date_of_making, CURRENT_DATE),
    COALESCE(v_order.product_date_of_making, CURRENT_DATE),
    COALESCE(v_order.branch_id, v_main_branch),
    v_first_image
  ) RETURNING id INTO v_product_id;

  UPDATE public.custom_orders
    SET inventory_product_id = v_product_id,
        product_sku = v_sku,
        updated_at = now()
    WHERE id = p_custom_order_id;

  INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
  VALUES (v_product_id, v_qty, 'in',
    'Created from in-house custom order ' || v_order.reference_number, p_custom_order_id, auth.uid());

  RETURN v_product_id;
END;
$$;
