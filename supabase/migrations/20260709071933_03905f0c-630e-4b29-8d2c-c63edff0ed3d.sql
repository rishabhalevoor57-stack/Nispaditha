
-- Track whether a custom order has already deducted inventory
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

-- Function: deduct inventory for all order items with product_id
CREATE OR REPLACE FUNCTION public.custom_order_deduct_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_item record;
  v_prod public.products%ROWTYPE;
  v_ref text;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Custom order not found'; END IF;
  IF v_order.stock_deducted THEN RETURN; END IF;

  v_ref := v_order.reference_number;

  -- Validate availability first
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

  -- Deduct
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

  UPDATE public.custom_orders SET stock_deducted = true, updated_at = now() WHERE id = p_order_id;
END;
$$;

-- Function: restore inventory for a previously deducted order
CREATE OR REPLACE FUNCTION public.custom_order_restore_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_item record;
  v_ref text;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
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

  UPDATE public.custom_orders SET stock_deducted = false, updated_at = now() WHERE id = p_order_id;
END;
$$;

-- Trigger: on status change to confirmed => deduct, to cancelled => restore
CREATE OR REPLACE FUNCTION public.custom_order_status_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Any forward move into a "confirmed or later" state (except cancelled) deducts stock once
    IF NEW.status IN ('confirmed','in_production','ready','delivered','invoiced')
       AND COALESCE(OLD.stock_deducted, false) = false
       AND COALESCE(NEW.stock_deducted, false) = false THEN
      PERFORM public.custom_order_deduct_stock(NEW.id);
      SELECT stock_deducted INTO NEW.stock_deducted FROM public.custom_orders WHERE id = NEW.id;
    END IF;

    IF NEW.status = 'cancelled' AND COALESCE(OLD.stock_deducted, false) = true THEN
      PERFORM public.custom_order_restore_stock(NEW.id);
      NEW.stock_deducted := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_order_status_stock_sync ON public.custom_orders;
CREATE TRIGGER trg_custom_order_status_stock_sync
  BEFORE UPDATE ON public.custom_orders
  FOR EACH ROW EXECUTE FUNCTION public.custom_order_status_stock_sync();

-- Trigger: restore stock before delete
CREATE OR REPLACE FUNCTION public.custom_order_delete_restore_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.stock_deducted, false) = true THEN
    PERFORM public.custom_order_restore_stock(OLD.id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_order_delete_restore_stock ON public.custom_orders;
CREATE TRIGGER trg_custom_order_delete_restore_stock
  BEFORE DELETE ON public.custom_orders
  FOR EACH ROW EXECUTE FUNCTION public.custom_order_delete_restore_stock();
