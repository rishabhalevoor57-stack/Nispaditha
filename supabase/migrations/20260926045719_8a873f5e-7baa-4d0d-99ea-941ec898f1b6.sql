CREATE OR REPLACE FUNCTION public.custom_order_deduct_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_item record;
  v_prod public.products%ROWTYPE;
  v_qty integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL OR v_order.stock_deducted THEN RETURN; END IF;

  FOR v_item IN
    SELECT product_id, sku, item_description, GREATEST(COALESCE(quantity, 0), 0) AS quantity
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := v_item.quantity;
    IF v_qty > 0 THEN
      SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;
      IF v_prod.id IS NULL THEN
        RAISE EXCEPTION 'Insufficient inventory: product not found (%)', COALESCE(v_item.sku, v_item.item_description);
      END IF;
      IF COALESCE(v_prod.quantity, 0) < v_qty THEN
        RAISE EXCEPTION 'Insufficient inventory for %: have % pcs, need % pcs', v_prod.sku, COALESCE(v_prod.quantity,0), v_qty;
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT product_id, GREATEST(COALESCE(quantity, 0), 0) AS quantity
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := v_item.quantity;
    IF v_qty > 0 THEN
      PERFORM public.log_stock_move(
        v_item.product_id, -v_qty, 0, 'custom_order', 'Custom Order Confirmed',
        p_order_id, v_order.reference_number,
        'Custom Order Confirmed ' || v_order.reference_number
      );
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.custom_order_restore_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_item record;
  v_qty integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL OR NOT v_order.stock_deducted THEN RETURN; END IF;

  FOR v_item IN
    SELECT product_id, GREATEST(COALESCE(quantity, 0), 0) AS quantity
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := v_item.quantity;
    IF v_qty > 0 THEN
      PERFORM public.log_stock_move(
        v_item.product_id, v_qty, 0, 'custom_order',
        CASE WHEN v_order.status = 'cancelled' THEN 'Custom Order Cancelled' ELSE 'Custom Order Stock Restored' END,
        p_order_id, v_order.reference_number,
        CASE WHEN v_order.status = 'cancelled'
             THEN 'Custom Order Cancelled ' || v_order.reference_number
             ELSE 'Custom Order Stock Restored ' || v_order.reference_number END
      );
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.replace_custom_order_lines(
  p_order_id uuid,
  p_items jsonb,
  p_components jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_was_deducted boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Custom order not found';
  END IF;

  v_was_deducted := COALESCE(v_order.stock_deducted, false);
  IF v_was_deducted THEN
    PERFORM public.custom_order_restore_stock(p_order_id);
    UPDATE public.custom_orders SET stock_deducted = false WHERE id = p_order_id;
  END IF;

  DELETE FROM public.custom_order_items WHERE custom_order_id = p_order_id;
  INSERT INTO public.custom_order_items (
    custom_order_id, product_id, sku, item_description, category,
    customization_notes, reference_image_url, quantity, expected_weight,
    pricing_mode, metal_type, flat_price, mc_per_gram, discount_on_mc,
    rate_per_gram, base_price, mc_amount, discount, discount_type,
    discount_value, item_total, strings_used
  )
  SELECT
    p_order_id, x.product_id, x.sku, COALESCE(x.item_description, ''), x.category,
    x.customization_notes, x.reference_image_url, GREATEST(COALESCE(x.quantity, 0), 0),
    COALESCE(x.expected_weight, 0), COALESCE(x.pricing_mode, 'weight_based'),
    COALESCE(x.metal_type, 'silver'), COALESCE(x.flat_price, 0), COALESCE(x.mc_per_gram, 0),
    COALESCE(x.discount_on_mc, 0), COALESCE(x.rate_per_gram, 0), COALESCE(x.base_price, 0),
    COALESCE(x.mc_amount, 0), COALESCE(x.discount, 0), COALESCE(x.discount_type, 'fixed'),
    COALESCE(x.discount_value, 0), COALESCE(x.item_total, 0), x.strings_used
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS x(
    product_id uuid, sku text, item_description text, category text,
    customization_notes text, reference_image_url text, quantity integer,
    expected_weight numeric, pricing_mode text, metal_type text, flat_price numeric,
    mc_per_gram numeric, discount_on_mc numeric, rate_per_gram numeric,
    base_price numeric, mc_amount numeric, discount numeric, discount_type text,
    discount_value numeric, item_total numeric, strings_used numeric
  );

  DELETE FROM public.custom_order_components WHERE custom_order_id = p_order_id;
  INSERT INTO public.custom_order_components (
    custom_order_id, product_id, sku, category, component_name, material,
    unit, weight_grams, quantity, quantity_used, strings_used, unit_price,
    rate_per_gram, total, discount_type, discount_value, discount
  )
  SELECT
    p_order_id, x.product_id, x.sku, x.category, COALESCE(x.component_name, ''), x.material,
    CASE WHEN x.unit = 'strings' THEN 'strings' ELSE 'quantity' END,
    COALESCE(x.weight_grams, 0), GREATEST(COALESCE(x.quantity, 0), 0),
    GREATEST(COALESCE(x.quantity_used, 0), 0), GREATEST(COALESCE(x.strings_used, 0), 0),
    COALESCE(x.unit_price, 0), COALESCE(x.rate_per_gram, 0), COALESCE(x.total, 0),
    COALESCE(x.discount_type, 'fixed'), COALESCE(x.discount_value, 0), COALESCE(x.discount, 0)
  FROM jsonb_to_recordset(COALESCE(p_components, '[]'::jsonb)) AS x(
    product_id uuid, sku text, category text, component_name text, material text,
    unit text, weight_grams numeric, quantity integer, quantity_used integer,
    strings_used numeric, unit_price numeric, rate_per_gram numeric, total numeric,
    discount_type text, discount_value numeric, discount numeric
  );

  IF v_was_deducted THEN
    PERFORM public.custom_order_deduct_stock(p_order_id);
    UPDATE public.custom_orders SET stock_deducted = true WHERE id = p_order_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_custom_order_lines(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_custom_order_lines(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_custom_order_lines(uuid, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.send_custom_order_to_inventory_v2(
  p_custom_order_id uuid,
  p_final_quantity integer DEFAULT 1,
  p_total_weight numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  v_use_qty integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_custom_order_id::text, 0));
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_custom_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Custom order not found'; END IF;
  IF v_order.order_type <> 'in_house' THEN RAISE EXCEPTION 'Only in-house orders can be sent to inventory'; END IF;
  IF v_order.inventory_product_id IS NOT NULL THEN RAISE EXCEPTION 'This order has already been sent to inventory'; END IF;

  v_qty := GREATEST(1, COALESCE(p_final_quantity, 1));
  v_sku := COALESCE(NULLIF(TRIM(v_order.product_sku),''), 'IH-' || REPLACE(v_order.reference_number, 'CO-', ''));
  IF EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SKU % already exists in inventory. Choose a different SKU.', v_sku;
  END IF;

  FOR v_comp IN
    SELECT * FROM public.custom_order_components
     WHERE custom_order_id = p_custom_order_id
  LOOP
    v_total_weight := v_total_weight + COALESCE(v_comp.weight_grams, 0);
    v_use_qty := GREATEST(COALESCE(v_comp.quantity_used, 0), 0);
    IF v_comp.product_id IS NOT NULL AND v_use_qty > 0 THEN
      SELECT * INTO v_prod FROM public.products WHERE id = v_comp.product_id FOR UPDATE;
      IF v_prod.id IS NULL THEN
        RAISE EXCEPTION 'Linked component product not found (SKU %)', COALESCE(v_comp.sku, v_comp.component_name);
      END IF;
      IF COALESCE(v_prod.quantity, 0) < v_use_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_prod.sku, v_prod.quantity, v_use_qty;
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
    v_order.product_description, v_order.product_category_id, v_total_weight, v_qty,
    COALESCE(v_order.product_buying_price, 0), COALESCE(v_order.product_selling_price, 0), 0,
    COALESCE(v_order.gst_percentage, 3), 1, v_order.product_vendor_id, 'Others', 'in_stock',
    COALESCE(v_order.product_selling_price, 0), 'flat_price', true,
    COALESCE(v_order.product_date_of_making, CURRENT_DATE),
    COALESCE(v_order.product_date_of_making, CURRENT_DATE),
    COALESCE(v_order.branch_id, v_main_branch), v_first_image
  ) RETURNING id INTO v_product_id;

  FOR v_comp IN
    SELECT * FROM public.custom_order_components
     WHERE custom_order_id = p_custom_order_id AND product_id IS NOT NULL
  LOOP
    v_use_qty := GREATEST(COALESCE(v_comp.quantity_used, 0), 0);
    IF v_use_qty > 0 THEN
      PERFORM public.log_stock_move(
        v_comp.product_id, -v_use_qty, 0, 'custom_order', 'In-House Component Used',
        p_custom_order_id, v_order.reference_number,
        'Component used in in-house order ' || v_order.reference_number
      );
    END IF;
  END LOOP;

  UPDATE public.custom_orders
     SET inventory_product_id = v_product_id,
         product_sku = v_sku,
         components_weight = v_total_weight,
         updated_at = now()
   WHERE id = p_custom_order_id;

  PERFORM public.log_stock_move(
    v_product_id, 0, 0, 'custom_order', 'In-House Product Created',
    p_custom_order_id, v_order.reference_number,
    'Created from in-house custom order ' || v_order.reference_number
  );

  RETURN v_product_id;
END;
$function$;