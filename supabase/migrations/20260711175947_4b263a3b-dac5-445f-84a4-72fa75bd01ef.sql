
-- Fix concurrent modification error on status changes by taking an advisory lock
-- and re-reading the order row inside the deduct/restore helpers.
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
  v_ref text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RETURN; END IF;
  IF v_order.stock_deducted THEN RETURN; END IF;

  v_ref := v_order.reference_number;

  FOR v_item IN
    SELECT product_id, sku, item_description, quantity, expected_weight, pricing_mode
    FROM public.custom_order_items
    WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF v_prod.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', COALESCE(v_item.sku, v_item.item_description);
    END IF;
    IF v_item.pricing_mode = 'weight_based' THEN
      IF COALESCE(v_prod.weight_grams, 0) < COALESCE(v_item.expected_weight, 0) * GREATEST(COALESCE(v_item.quantity,1),1) THEN
        RAISE EXCEPTION 'Insufficient weight for %: have % g, need % g',
          v_prod.sku, v_prod.weight_grams,
          COALESCE(v_item.expected_weight,0) * GREATEST(COALESCE(v_item.quantity,1),1);
      END IF;
    ELSE
      IF COALESCE(v_prod.quantity, 0) < COALESCE(v_item.quantity, 1) THEN
        RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_prod.sku, v_prod.quantity, v_item.quantity;
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT product_id, sku, item_description, quantity, expected_weight, pricing_mode
    FROM public.custom_order_items
    WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    IF v_item.pricing_mode = 'weight_based' THEN
      UPDATE public.products
        SET weight_grams = GREATEST(0, weight_grams - COALESCE(v_item.expected_weight,0) * GREATEST(COALESCE(v_item.quantity,1),1)),
            updated_at = now()
        WHERE id = v_item.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_item.product_id, 0, 'out',
        'Custom order confirmed ' || v_ref, p_order_id, auth.uid());
    ELSE
      UPDATE public.products
        SET quantity = GREATEST(0, quantity - COALESCE(v_item.quantity,1)), updated_at = now()
        WHERE id = v_item.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_item.product_id, -COALESCE(v_item.quantity,1), 'out',
        'Custom order confirmed ' || v_ref, p_order_id, auth.uid());
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
  v_ref text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RETURN; END IF;
  IF NOT v_order.stock_deducted THEN RETURN; END IF;

  v_ref := v_order.reference_number;

  FOR v_item IN
    SELECT product_id, sku, quantity, expected_weight, pricing_mode
    FROM public.custom_order_items
    WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    IF v_item.pricing_mode = 'weight_based' THEN
      UPDATE public.products
        SET weight_grams = weight_grams + COALESCE(v_item.expected_weight,0) * GREATEST(COALESCE(v_item.quantity,1),1),
            updated_at = now()
        WHERE id = v_item.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_item.product_id, 0, 'in',
        'Custom order restored ' || v_ref, p_order_id, auth.uid());
    ELSE
      UPDATE public.products
        SET quantity = quantity + COALESCE(v_item.quantity,1), updated_at = now()
        WHERE id = v_item.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_item.product_id, COALESCE(v_item.quantity,1), 'in',
        'Custom order restored ' || v_ref, p_order_id, auth.uid());
    END IF;
  END LOOP;
END;
$function$;

-- Search speed-ups for repair items and suppliers (global search)
CREATE INDEX IF NOT EXISTS idx_repair_items_sku_trgm
  ON public.repair_items USING gin (lower(COALESCE(sku, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_repair_items_name_trgm
  ON public.repair_items USING gin (lower(COALESCE(product_name, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_repair_items_client_trgm
  ON public.repair_items USING gin (lower(COALESCE(client_name, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
  ON public.suppliers USING gin (lower(COALESCE(name, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone_trgm
  ON public.suppliers USING gin (COALESCE(phone, '') gin_trgm_ops);
