-- Create trigger for auto stock reduction on invoice item insert
DROP TRIGGER IF EXISTS reduce_stock_on_invoice_item ON public.invoice_items;

CREATE TRIGGER reduce_stock_on_invoice_item
AFTER INSERT ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.reduce_stock_on_invoice();