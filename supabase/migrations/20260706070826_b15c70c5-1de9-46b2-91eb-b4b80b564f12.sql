
-- Extend custom_order_components with inventory linkage and multi-unit usage
ALTER TABLE public.custom_order_components
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS strings_used numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'weight_based'
    CHECK (unit IN ('weight_based','quantity','strings'));

CREATE INDEX IF NOT EXISTS idx_custom_order_components_product ON public.custom_order_components(product_id);

-- Send in-house custom order to inventory (v2): deducts components + creates finished product
CREATE OR REPLACE FUNCTION public.send_custom_order_to_inventory_v2(
  p_custom_order_id uuid,
  p_final_quantity integer DEFAULT 1,
  p_total_weight numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_comp record;
  v_prod public.products%ROWTYPE;
  v_product_id uuid;
  v_sku text;
  v_main_branch uuid;
  v_qty integer;
  v_first_image text;
  v_total_weight numeric := 0;
  v_use_weight numeric;
  v_use_qty integer;
  v_use_strings numeric;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_custom_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Custom order not found'; END IF;
  IF v_order.order_type <> 'in_house' THEN RAISE EXCEPTION 'Only in-house orders can be sent to inventory'; END IF;
  IF v_order.inventory_product_id IS NOT NULL THEN RAISE EXCEPTION 'This order has already been sent to inventory'; END IF;

  v_qty := GREATEST(1, COALESCE(p_final_quantity, 1));
  v_sku := COALESCE(NULLIF(TRIM(v_order.product_sku),''), 'IH-' || REPLACE(v_order.reference_number, 'CO-', ''));

  IF EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SKU % already exists in inventory. Choose a different SKU.', v_sku;
  END IF;

  -- Validate every component linked to inventory has enough stock, and compute total weight of weight_based ones
  FOR v_comp IN
    SELECT * FROM public.custom_order_components
    WHERE custom_order_id = p_custom_order_id
  LOOP
    v_use_weight := COALESCE(v_comp.weight_grams,0) * GREATEST(COALESCE(v_comp.quantity,1),1);
    v_use_qty := COALESCE(v_comp.quantity_used, 0);
    v_use_strings := COALESCE(v_comp.strings_used, 0);

    IF v_comp.unit = 'weight_based' THEN
      v_total_weight := v_total_weight + v_use_weight;
    END IF;

    IF v_comp.product_id IS NOT NULL THEN
      SELECT * INTO v_prod FROM public.products WHERE id = v_comp.product_id FOR UPDATE;
      IF v_prod.id IS NULL THEN
        RAISE EXCEPTION 'Linked component product not found (SKU %)', COALESCE(v_comp.sku, v_comp.component_name);
      END IF;
      IF v_comp.unit = 'weight_based' THEN
        IF COALESCE(v_prod.weight_grams,0) < v_use_weight THEN
          RAISE EXCEPTION 'Insufficient weight for %: have % g, need % g', v_prod.sku, v_prod.weight_grams, v_use_weight;
        END IF;
      ELSIF v_comp.unit = 'quantity' THEN
        IF COALESCE(v_prod.quantity,0) < v_use_qty THEN
          RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_prod.sku, v_prod.quantity, v_use_qty;
        END IF;
      ELSIF v_comp.unit = 'strings' THEN
        IF COALESCE(v_prod.strings_count,0) < v_use_strings THEN
          RAISE EXCEPTION 'Insufficient strings for %: have %, need %', v_prod.sku, v_prod.strings_count, v_use_strings;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF p_total_weight IS NOT NULL AND p_total_weight > 0 THEN
    v_total_weight := p_total_weight;
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
    v_total_weight,
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

  -- Now deduct component stock and log history
  FOR v_comp IN
    SELECT * FROM public.custom_order_components
    WHERE custom_order_id = p_custom_order_id
      AND product_id IS NOT NULL
  LOOP
    v_use_weight := COALESCE(v_comp.weight_grams,0) * GREATEST(COALESCE(v_comp.quantity,1),1);
    v_use_qty := COALESCE(v_comp.quantity_used, 0);
    v_use_strings := COALESCE(v_comp.strings_used, 0);

    IF v_comp.unit = 'weight_based' THEN
      UPDATE public.products SET weight_grams = GREATEST(0, weight_grams - v_use_weight), updated_at = now()
        WHERE id = v_comp.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_comp.product_id, 0, 'out',
        'Component used in in-house order ' || v_order.reference_number || ' (' || v_use_weight || ' g)',
        p_custom_order_id, auth.uid());
    ELSIF v_comp.unit = 'quantity' THEN
      UPDATE public.products SET quantity = GREATEST(0, quantity - v_use_qty), updated_at = now()
        WHERE id = v_comp.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_comp.product_id, -v_use_qty, 'out',
        'Component used in in-house order ' || v_order.reference_number,
        p_custom_order_id, auth.uid());
    ELSIF v_comp.unit = 'strings' THEN
      UPDATE public.products SET strings_count = GREATEST(0, COALESCE(strings_count,0) - v_use_strings), updated_at = now()
        WHERE id = v_comp.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_comp.product_id, 0, 'out',
        'Component used in in-house order ' || v_order.reference_number || ' (' || v_use_strings || ' strings)',
        p_custom_order_id, auth.uid());
    END IF;
  END LOOP;

  UPDATE public.custom_orders
    SET inventory_product_id = v_product_id,
        product_sku = v_sku,
        components_weight = v_total_weight,
        updated_at = now()
    WHERE id = p_custom_order_id;

  INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
  VALUES (v_product_id, v_qty, 'in',
    'Created from in-house custom order ' || v_order.reference_number, p_custom_order_id, auth.uid());

  RETURN v_product_id;
END;
$$;
