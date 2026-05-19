-- Update stock triggers to skip stock movement for DRAFT invoices.
-- Drafts are not confirmed sales and must not affect inventory until finalized.

CREATE OR REPLACE FUNCTION public.reduce_stock_on_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    inv_status text;
BEGIN
    IF NEW.product_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status INTO inv_status FROM public.invoices WHERE id = NEW.invoice_id;
    IF inv_status = 'draft' THEN
        RETURN NEW; -- do not deduct stock for draft invoices
    END IF;

    UPDATE public.products
    SET quantity = GREATEST(0, quantity - NEW.quantity)
    WHERE id = NEW.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (NEW.product_id, -NEW.quantity, 'out', 'Invoice sale', NEW.invoice_id, auth.uid());

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_stock_on_invoice_item_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    inv_status text;
BEGIN
    IF OLD.product_id IS NULL THEN
        RETURN OLD;
    END IF;

    SELECT status INTO inv_status FROM public.invoices WHERE id = OLD.invoice_id;
    IF inv_status = 'draft' THEN
        RETURN OLD; -- nothing to restore, drafts never deducted
    END IF;

    UPDATE public.products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (OLD.product_id, OLD.quantity, 'in', 'Invoice item removed/deleted', OLD.invoice_id, auth.uid());

    RETURN OLD;
END;
$function$;