-- 1. Allow Inventory -> Repair
ALTER TABLE public.repair_items DROP CONSTRAINT IF EXISTS repair_items_source_check;
ALTER TABLE public.repair_items ADD CONSTRAINT repair_items_source_check
  CHECK (source = ANY (ARRAY['return','exchange','buyback','manual','inventory','custom_order','service']));

-- 2. Restore stock when a manual sold entry is deleted
DROP TRIGGER IF EXISTS trg_restore_stock_on_manual_sold_delete ON public.manual_sold_items;
CREATE TRIGGER trg_restore_stock_on_manual_sold_delete
  AFTER DELETE ON public.manual_sold_items
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_manual_sold_delete();

-- 3. Client totals auto-sync
CREATE OR REPLACE FUNCTION public.recalc_client_totals(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_due numeric := 0;
  v_last timestamptz;
BEGIN
  IF p_client_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(i.grand_total), 0),
    COALESCE(SUM(GREATEST(0, COALESCE(i.balance_due, i.grand_total - COALESCE(i.total_paid,0)))), 0),
    MAX(i.invoice_date)::timestamptz
  INTO v_total, v_due, v_last
  FROM public.invoices i
  WHERE i.client_id = p_client_id
    AND COALESCE(i.status, '') <> 'cancelled';

  UPDATE public.clients
  SET total_purchases = v_total,
      outstanding_balance = v_due,
      last_invoice_date = v_last,
      updated_at = now()
  WHERE id = p_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_totals_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_client_totals(OLD.client_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    PERFORM public.recalc_client_totals(OLD.client_id);
  END IF;
  PERFORM public.recalc_client_totals(NEW.client_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_totals ON public.invoices;
CREATE TRIGGER trg_sync_client_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_totals_from_invoice();

CREATE OR REPLACE FUNCTION public.sync_client_totals_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client uuid;
BEGIN
  SELECT client_id INTO v_client FROM public.invoices
   WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  PERFORM public.recalc_client_totals(v_client);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_totals_payment ON public.invoice_payments;
CREATE TRIGGER trg_sync_client_totals_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_totals_from_payment();