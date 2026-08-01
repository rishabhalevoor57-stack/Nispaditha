-- 1. Custom order stock deduction: deduct BOTH quantity and weight
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
  v_qty integer;
  v_wt numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RETURN; END IF;
  IF v_order.stock_deducted THEN RETURN; END IF;

  v_ref := v_order.reference_number;

  -- Validate
  FOR v_item IN
    SELECT product_id, sku, item_description, quantity, expected_weight
    FROM public.custom_order_items
    WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    v_wt  := COALESCE(v_item.expected_weight, 0) * v_qty;

    SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF v_prod.id IS NULL THEN
      RAISE EXCEPTION 'Insufficient inventory: product not found (%)', COALESCE(v_item.sku, v_item.item_description);
    END IF;

    IF COALESCE(v_prod.quantity, 0) < v_qty THEN
      RAISE EXCEPTION 'Insufficient inventory for %: have % pcs, need % pcs', v_prod.sku, COALESCE(v_prod.quantity,0), v_qty;
    END IF;
    IF v_wt > 0 AND COALESCE(v_prod.weight_grams, 0) < v_wt THEN
      RAISE EXCEPTION 'Insufficient inventory for %: have % g, need % g', v_prod.sku, COALESCE(v_prod.weight_grams,0), v_wt;
    END IF;
  END LOOP;

  -- Apply
  FOR v_item IN
    SELECT product_id, sku, item_description, quantity, expected_weight
    FROM public.custom_order_items
    WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    v_wt  := COALESCE(v_item.expected_weight, 0) * v_qty;

    UPDATE public.products
      SET quantity = GREATEST(0, COALESCE(quantity,0) - v_qty),
          weight_grams = GREATEST(0, COALESCE(weight_grams,0) - v_wt),
          updated_at = now()
      WHERE id = v_item.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (v_item.product_id, -v_qty, 'out',
      'Custom order confirmed ' || v_ref || ' (' || v_qty || ' pcs, ' || v_wt || ' g)', p_order_id, auth.uid());
  END LOOP;
END;
$function$;

-- 2. Restore mirrors the deduction
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
  v_qty integer;
  v_wt numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RETURN; END IF;
  IF NOT v_order.stock_deducted THEN RETURN; END IF;

  v_ref := v_order.reference_number;

  FOR v_item IN
    SELECT product_id, sku, quantity, expected_weight
    FROM public.custom_order_items
    WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    v_wt  := COALESCE(v_item.expected_weight, 0) * v_qty;

    UPDATE public.products
      SET quantity = COALESCE(quantity,0) + v_qty,
          weight_grams = COALESCE(weight_grams,0) + v_wt,
          updated_at = now()
      WHERE id = v_item.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (v_item.product_id, v_qty, 'in',
      'Custom order restored ' || v_ref || ' (' || v_qty || ' pcs, ' || v_wt || ' g)', p_order_id, auth.uid());
  END LOOP;
END;
$function$;

-- 3. Duplicate SKU cleanup (safe: soft-delete only exact, untouched duplicates)
WITH ranked AS (
  SELECT p.id, p.sku, p.weight_grams, p.quantity, p.created_at,
         ROW_NUMBER() OVER (PARTITION BY p.sku ORDER BY p.created_at) AS rn,
         FIRST_VALUE(p.weight_grams) OVER (PARTITION BY p.sku ORDER BY p.created_at) AS first_wt,
         FIRST_VALUE(p.quantity) OVER (PARTITION BY p.sku ORDER BY p.created_at) AS first_qty
  FROM public.products p
  WHERE p.deleted_at IS NULL
    AND p.sku IN (SELECT sku FROM public.products WHERE deleted_at IS NULL GROUP BY sku HAVING COUNT(*) > 1)
)
UPDATE public.products t
SET deleted_at = now()
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1
  AND r.weight_grams = r.first_wt
  AND r.quantity = r.first_qty
  AND NOT EXISTS (SELECT 1 FROM public.stock_history sh WHERE sh.product_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_items ii WHERE ii.product_id = t.id);

-- Rename remaining genuine duplicates so no stock is lost
WITH ranked AS (
  SELECT p.id, p.sku,
         ROW_NUMBER() OVER (PARTITION BY p.sku ORDER BY p.created_at) AS rn
  FROM public.products p
  WHERE p.deleted_at IS NULL
    AND p.sku IN (SELECT sku FROM public.products WHERE deleted_at IS NULL GROUP BY sku HAVING COUNT(*) > 1)
)
UPDATE public.products t
SET sku = r.sku || '-' || r.rn
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 4. Enforce SKU uniqueness for active products
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_active_unique
  ON public.products (sku) WHERE deleted_at IS NULL;