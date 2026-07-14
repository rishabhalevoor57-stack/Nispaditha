-- Fix "tuple to be updated was already modified" error on custom order status changes.
-- Root cause: BEFORE UPDATE trigger called deduct_stock which selected the row being updated,
-- combined with concurrent stock_history triggers producing re-entrance conflicts.
-- Solution: switch to AFTER UPDATE, guard against recursion with pg_trigger_depth(),
-- and update stock_deducted via an explicit UPDATE (which the guard prevents from looping).

DROP TRIGGER IF EXISTS trg_custom_order_status_stock_sync ON public.custom_orders;

CREATE OR REPLACE FUNCTION public.custom_order_status_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent recursion when we UPDATE custom_orders.stock_deducted below
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('confirmed','in_production','ready','delivered','invoiced','released')
       AND COALESCE(NEW.stock_deducted, false) = false THEN
      PERFORM public.custom_order_deduct_stock(NEW.id);
      UPDATE public.custom_orders SET stock_deducted = true WHERE id = NEW.id;
    END IF;

    IF NEW.status = 'cancelled' AND COALESCE(NEW.stock_deducted, false) = true THEN
      PERFORM public.custom_order_restore_stock(NEW.id);
      UPDATE public.custom_orders SET stock_deducted = false WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_custom_order_status_stock_sync
  AFTER UPDATE ON public.custom_orders
  FOR EACH ROW EXECUTE FUNCTION public.custom_order_status_stock_sync();