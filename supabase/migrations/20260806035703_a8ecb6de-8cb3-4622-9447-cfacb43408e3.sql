
-- 1. Richer stock movement log
ALTER TABLE public.stock_history
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS quantity_before integer,
  ADD COLUMN IF NOT EXISTS quantity_after integer,
  ADD COLUMN IF NOT EXISTS weight_before numeric,
  ADD COLUMN IF NOT EXISTS weight_after numeric,
  ADD COLUMN IF NOT EXISTS reference_label text;

-- 2. Central helper: applies a stock delta and logs before/after state
CREATE OR REPLACE FUNCTION public.log_stock_move(
  p_product_id uuid,
  p_qty_delta integer,
  p_weight_delta numeric,
  p_module text,
  p_action text,
  p_reference_id uuid,
  p_reference_label text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  qb integer; wb numeric; qa integer; wa numeric;
BEGIN
  IF p_product_id IS NULL THEN RETURN; END IF;

  SELECT quantity, COALESCE(weight_grams, 0) INTO qb, wb
  FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF qb IS NULL THEN RETURN; END IF;

  qa := GREATEST(0, qb + COALESCE(p_qty_delta, 0));
  wa := GREATEST(0, wb + COALESCE(p_weight_delta, 0));

  UPDATE public.products
     SET quantity = qa,
         weight_grams = CASE WHEN COALESCE(p_weight_delta,0) <> 0 THEN wa ELSE weight_grams END,
         updated_at = now()
   WHERE id = p_product_id;

  INSERT INTO public.stock_history (
    product_id, quantity_change, type, reason, reference_id, created_by,
    module, action, quantity_before, quantity_after, weight_before, weight_after, reference_label
  ) VALUES (
    p_product_id, COALESCE(p_qty_delta,0),
    CASE WHEN COALESCE(p_qty_delta,0) + COALESCE(p_weight_delta,0) < 0 THEN 'out' ELSE 'in' END,
    p_reason, p_reference_id, auth.uid(),
    p_module, p_action, qb, qa, wb,
    CASE WHEN COALESCE(p_weight_delta,0) <> 0 THEN wa ELSE wb END,
    p_reference_label
  );
END;
$$;

-- 3. Explicit deduction state on invoice lines
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

-- Backfill: live invoices already had stock deducted, unless a custom order did it
UPDATE public.invoice_items ii
   SET stock_deducted = true
  FROM public.invoices i
 WHERE i.id = ii.invoice_id
   AND ii.product_id IS NOT NULL
   AND i.status IN ('sent','paid');

UPDATE public.invoice_items ii
   SET stock_deducted = false
 WHERE EXISTS (
   SELECT 1 FROM public.custom_orders co
    WHERE co.converted_to_invoice_id = ii.invoice_id
      AND COALESCE(co.stock_deducted, false) = true
 );

-- 4. Deduct on invoice item insert (skips drafts and CO-sourced invoices)
CREATE OR REPLACE FUNCTION public.reduce_stock_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv_status text;
  inv_number text;
  prod_name text;
  prod_qty integer;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  SELECT status, invoice_number INTO inv_status, inv_number
    FROM public.invoices WHERE id = NEW.invoice_id;

  -- Custom order already deducted this stock at confirmation
  IF EXISTS (
    SELECT 1 FROM public.custom_orders co
     WHERE co.converted_to_invoice_id = NEW.invoice_id
       AND COALESCE(co.stock_deducted, false) = true
  ) THEN
    RETURN NEW;
  END IF;

  IF inv_status IS DISTINCT FROM 'sent' AND inv_status IS DISTINCT FROM 'paid' THEN
    SELECT name, quantity INTO prod_name, prod_qty FROM public.products WHERE id = NEW.product_id;
    INSERT INTO public.stock_deduction_blocks (
      invoice_id, invoice_number, invoice_status, product_id, product_name,
      attempted_quantity, current_stock, reason, attempted_by
    ) VALUES (
      NEW.invoice_id, inv_number, COALESCE(inv_status,'unknown'), NEW.product_id, prod_name,
      NEW.quantity, prod_qty,
      'Stock deduction deferred: invoice status "' || COALESCE(inv_status,'unknown') || '" is not Saved/Completed',
      auth.uid()
    );
    RETURN NEW;
  END IF;

  PERFORM public.log_stock_move(
    NEW.product_id, -NEW.quantity, 0, 'invoice', 'Invoice Sale',
    NEW.invoice_id, inv_number, 'Invoice Sale ' || COALESCE(inv_number,'')
  );

  UPDATE public.invoice_items SET stock_deducted = true WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 5. Restore ONLY if this line actually deducted stock
CREATE OR REPLACE FUNCTION public.restore_stock_on_invoice_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv_number text;
BEGIN
  IF OLD.product_id IS NULL OR COALESCE(OLD.stock_deducted, false) = false THEN
    RETURN OLD;
  END IF;

  SELECT invoice_number INTO inv_number FROM public.invoices WHERE id = OLD.invoice_id;

  PERFORM public.log_stock_move(
    OLD.product_id, OLD.quantity, 0, 'invoice', 'Invoice Item Removed',
    OLD.invoice_id, inv_number, 'Invoice Item Removed ' || COALESCE(inv_number,'')
  );
  RETURN OLD;
END;
$$;

-- 6. Invoice status transitions drive stock
CREATE OR REPLACE FUNCTION public.invoice_status_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it record;
  co_done boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.custom_orders co
     WHERE co.converted_to_invoice_id = NEW.id
       AND COALESCE(co.stock_deducted, false) = true
  ) INTO co_done;

  IF NEW.status IN ('sent','paid') AND NOT co_done THEN
    FOR it IN
      SELECT id, product_id, quantity FROM public.invoice_items
       WHERE invoice_id = NEW.id AND product_id IS NOT NULL
         AND COALESCE(stock_deducted,false) = false
    LOOP
      PERFORM public.log_stock_move(
        it.product_id, -it.quantity, 0, 'invoice', 'Invoice Sale',
        NEW.id, NEW.invoice_number, 'Invoice Sale ' || NEW.invoice_number
      );
      UPDATE public.invoice_items SET stock_deducted = true WHERE id = it.id;
    END LOOP;
  ELSIF NEW.status = 'cancelled' THEN
    FOR it IN
      SELECT id, product_id, quantity FROM public.invoice_items
       WHERE invoice_id = NEW.id AND product_id IS NOT NULL
         AND COALESCE(stock_deducted,false) = true
    LOOP
      PERFORM public.log_stock_move(
        it.product_id, it.quantity, 0, 'invoice', 'Invoice Cancelled',
        NEW.id, NEW.invoice_number, 'Invoice Cancelled ' || NEW.invoice_number
      );
      UPDATE public.invoice_items SET stock_deducted = false WHERE id = it.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_status_stock_sync ON public.invoices;
CREATE TRIGGER trg_invoice_status_stock_sync
AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.invoice_status_stock_sync();

-- 7. Manual sales use the shared logger
CREATE OR REPLACE FUNCTION public.reduce_stock_on_manual_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    PERFORM public.log_stock_move(
      NEW.product_id, -NEW.quantity, 0, 'sold', 'Manual Sale',
      NEW.id, NEW.sku, 'Manual Sale' || COALESCE(' — ' || NEW.sku, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_stock_on_manual_sold_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.product_id IS NOT NULL THEN
    PERFORM public.log_stock_move(
      OLD.product_id, OLD.quantity, 0, 'sold', 'Manual Sale Deleted',
      OLD.id, OLD.sku, 'Manual Sale Deleted' || COALESCE(' — ' || OLD.sku, '')
    );
  END IF;
  RETURN OLD;
END;
$$;

-- 8. Custom order stock moves use the shared logger
CREATE OR REPLACE FUNCTION public.custom_order_deduct_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_item record;
  v_prod public.products%ROWTYPE;
  v_qty integer;
  v_wt numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL OR v_order.stock_deducted THEN RETURN; END IF;

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

  FOR v_item IN
    SELECT product_id, quantity, expected_weight
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    v_wt  := COALESCE(v_item.expected_weight, 0) * v_qty;
    PERFORM public.log_stock_move(
      v_item.product_id, -v_qty, -v_wt, 'custom_order', 'Custom Order Confirmed',
      p_order_id, v_order.reference_number,
      'Custom Order Confirmed ' || v_order.reference_number
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.custom_order_restore_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_item record;
  v_qty integer;
  v_wt numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF v_order.id IS NULL OR NOT v_order.stock_deducted THEN RETURN; END IF;

  FOR v_item IN
    SELECT product_id, quantity, expected_weight
      FROM public.custom_order_items
     WHERE custom_order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    v_qty := GREATEST(COALESCE(v_item.quantity, 1), 1);
    v_wt  := COALESCE(v_item.expected_weight, 0) * v_qty;
    PERFORM public.log_stock_move(
      v_item.product_id, v_qty, v_wt, 'custom_order',
      CASE WHEN v_order.status = 'cancelled' THEN 'Custom Order Cancelled' ELSE 'Custom Order Stock Restored' END,
      p_order_id, v_order.reference_number,
      CASE WHEN v_order.status = 'cancelled'
           THEN 'Custom Order Cancelled ' || v_order.reference_number
           ELSE 'Custom Order Stock Restored ' || v_order.reference_number END
    );
  END LOOP;
END;
$$;
