-- Weight is reference data: only explicit manual inventory operations may change it.
CREATE OR REPLACE FUNCTION public.log_stock_move(p_product_id uuid, p_qty_delta integer, p_weight_delta numeric, p_module text, p_action text, p_reference_id uuid, p_reference_label text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  qb integer; wb numeric; qa integer; wa numeric; wd numeric;
BEGIN
  IF p_product_id IS NULL THEN RETURN; END IF;

  -- Only explicit, user-initiated inventory operations may alter stored weight.
  wd := CASE
          WHEN COALESCE(p_module,'') IN ('adjustment','transfer','melting','inventory_adjustment')
          THEN COALESCE(p_weight_delta, 0)
          ELSE 0
        END;

  SELECT quantity, COALESCE(weight_grams, 0) INTO qb, wb
  FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF qb IS NULL THEN RETURN; END IF;

  qa := GREATEST(0, qb + COALESCE(p_qty_delta, 0));
  wa := GREATEST(0, wb + wd);

  UPDATE public.products
     SET quantity = qa,
         weight_grams = CASE WHEN wd <> 0 THEN wa ELSE weight_grams END,
         updated_at = now()
   WHERE id = p_product_id;

  INSERT INTO public.stock_history (
    product_id, quantity_change, type, reason, reference_id, created_by,
    module, action, quantity_before, quantity_after, weight_before, weight_after, reference_label
  ) VALUES (
    p_product_id, COALESCE(p_qty_delta,0),
    CASE WHEN COALESCE(p_qty_delta,0) + wd < 0 THEN 'out' ELSE 'in' END,
    p_reason, p_reference_id, auth.uid(),
    p_module, p_action, qb, qa, wb,
    CASE WHEN wd <> 0 THEN wa ELSE wb END,
    p_reference_label
  );
END;
$function$;

-- Custom orders: deduct quantity only, never weight.
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
    SELECT product_id, sku, item_description, quantity
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF v_prod.id IS NULL THEN
      RAISE EXCEPTION 'Insufficient inventory: product not found (%)', COALESCE(v_item.sku, v_item.item_description);
    END IF;
    IF COALESCE(v_prod.quantity, 0) < v_qty THEN
      RAISE EXCEPTION 'Insufficient inventory for %: have % pcs, need % pcs', v_prod.sku, COALESCE(v_prod.quantity,0), v_qty;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT product_id, quantity
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    PERFORM public.log_stock_move(
      v_item.product_id, -v_qty, 0, 'custom_order', 'Custom Order Confirmed',
      p_order_id, v_order.reference_number,
      'Custom Order Confirmed ' || v_order.reference_number
    );
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
    SELECT product_id, quantity
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    PERFORM public.log_stock_move(
      v_item.product_id, v_qty, 0, 'custom_order',
      CASE WHEN v_order.status = 'cancelled' THEN 'Custom Order Cancelled' ELSE 'Custom Order Stock Restored' END,
      p_order_id, v_order.reference_number,
      CASE WHEN v_order.status = 'cancelled'
           THEN 'Custom Order Cancelled ' || v_order.reference_number
           ELSE 'Custom Order Stock Restored ' || v_order.reference_number END
    );
  END LOOP;
END;
$function$;