
-- 1) Fix "tuple already modified" bug in custom_order_status_stock_sync trigger
-- Root cause: the deduct/restore functions did an UPDATE on custom_orders inside a BEFORE UPDATE trigger on custom_orders.
-- We split the mutation off: the functions no longer touch custom_orders.stock_deducted; the trigger sets NEW.stock_deducted directly.

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
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Custom order not found'; END IF;
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
        'Custom order confirmed ' || v_ref || ' (' ||
        COALESCE(v_item.expected_weight,0) * GREATEST(COALESCE(v_item.quantity,1),1) || ' g)',
        p_order_id, auth.uid());
    ELSE
      UPDATE public.products
        SET quantity = GREATEST(0, quantity - COALESCE(v_item.quantity,1)), updated_at = now()
        WHERE id = v_item.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_item.product_id, -COALESCE(v_item.quantity,1), 'out',
        'Custom order confirmed ' || v_ref, p_order_id, auth.uid());
    END IF;
  END LOOP;

  -- NOTE: intentionally do NOT update custom_orders.stock_deducted here.
  -- Callers (trigger or app) are responsible for setting that flag.
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
        'Custom order restored ' || v_ref || ' (' ||
        COALESCE(v_item.expected_weight,0) * GREATEST(COALESCE(v_item.quantity,1),1) || ' g)',
        p_order_id, auth.uid());
    ELSE
      UPDATE public.products
        SET quantity = quantity + COALESCE(v_item.quantity,1), updated_at = now()
        WHERE id = v_item.product_id;
      INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
      VALUES (v_item.product_id, COALESCE(v_item.quantity,1), 'in',
        'Custom order restored ' || v_ref, p_order_id, auth.uid());
    END IF;
  END LOOP;

  -- NOTE: caller sets custom_orders.stock_deducted = false
END;
$function$;

CREATE OR REPLACE FUNCTION public.custom_order_status_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Move into any post-draft state (except cancelled): deduct once
    IF NEW.status IN ('confirmed','in_production','ready','delivered','invoiced','released')
       AND COALESCE(OLD.stock_deducted, false) = false THEN
      PERFORM public.custom_order_deduct_stock(NEW.id);
      NEW.stock_deducted := true;
    END IF;

    IF NEW.status = 'cancelled' AND COALESCE(OLD.stock_deducted, false) = true THEN
      PERFORM public.custom_order_restore_stock(NEW.id);
      NEW.stock_deducted := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Metal type per Order Item (silver / gold_18k / gold_22k / gold_24k)
ALTER TABLE public.custom_order_items
  ADD COLUMN IF NOT EXISTS metal_type text NOT NULL DEFAULT 'silver';
