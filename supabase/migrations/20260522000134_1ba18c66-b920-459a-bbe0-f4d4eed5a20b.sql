
-- Fix negative quantities
UPDATE public.products SET quantity = 0 WHERE quantity < 0;

-- Add CHECK constraint to prevent future negatives
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qty_min_zero') THEN
    ALTER TABLE public.products ADD CONSTRAINT qty_min_zero CHECK (quantity >= 0);
  END IF;
END $$;

-- Recreate missing triggers for invoice stock movements
DROP TRIGGER IF EXISTS trg_reduce_stock_on_invoice_item ON public.invoice_items;
CREATE TRIGGER trg_reduce_stock_on_invoice_item
AFTER INSERT ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_invoice();

DROP TRIGGER IF EXISTS trg_restore_stock_on_invoice_item_delete ON public.invoice_items;
CREATE TRIGGER trg_restore_stock_on_invoice_item_delete
AFTER DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_invoice_item_delete();

-- Add client_source column on invoices for client type/source labels
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_source TEXT;
