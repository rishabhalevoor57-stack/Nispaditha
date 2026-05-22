-- Recreate all missing triggers that drive core business logic.
-- Functions already exist; only triggers were missing.

-- 1) Inventory deduction/restore on invoice items (skips drafts internally)
DROP TRIGGER IF EXISTS trg_reduce_stock_on_invoice_item ON public.invoice_items;
CREATE TRIGGER trg_reduce_stock_on_invoice_item
AFTER INSERT ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_invoice();

DROP TRIGGER IF EXISTS trg_restore_stock_on_invoice_item_delete ON public.invoice_items;
CREATE TRIGGER trg_restore_stock_on_invoice_item_delete
AFTER DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_invoice_item_delete();

-- 2) Manual sold items: reduce on insert (no restore-on-delete trigger, per project rule:
--    deleting a sold record is record-only cleanup)
DROP TRIGGER IF EXISTS trg_reduce_stock_on_manual_sold ON public.manual_sold_items;
CREATE TRIGGER trg_reduce_stock_on_manual_sold
AFTER INSERT ON public.manual_sold_items
FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_manual_sold();

-- 3) Auth: auto-create profile + role on new auth user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Log metal rate changes
DROP TRIGGER IF EXISTS trg_log_rate_change ON public.business_settings;
CREATE TRIGGER trg_log_rate_change
AFTER UPDATE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION public.log_rate_change();

-- 5) updated_at maintenance on tables that have the column
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'business_settings','categories','client_schemes','clients','custom_order_items',
    'custom_orders','expenses','order_notes','product_store_quantities','products',
    'profiles','repair_items','return_exchanges','store_wallets','stores','suppliers',
    'types_of_work','vendor_payments','invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t
    );
  END LOOP;
END $$;