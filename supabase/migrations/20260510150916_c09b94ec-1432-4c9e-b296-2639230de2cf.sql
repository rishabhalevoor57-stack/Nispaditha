
-- ===== Invoice Payments table for multi-payment receipts =====
CREATE TABLE IF NOT EXISTS public.invoice_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL,
    receipt_number text NOT NULL UNIQUE,
    amount numeric NOT NULL DEFAULT 0,
    payment_mode text NOT NULL DEFAULT 'cash',
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    notes text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view invoice payments"
ON public.invoice_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert invoice payments"
ON public.invoice_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice payments"
ON public.invoice_payments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete invoice payments"
ON public.invoice_payments FOR DELETE TO authenticated USING (public.is_admin());

-- ===== Receipt number generator =====
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    next_num INTEGER;
    receipt_num TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.invoice_payments
    WHERE receipt_number LIKE 'RCP-%';

    receipt_num := 'RCP-' || LPAD(next_num::TEXT, 6, '0');
    RETURN receipt_num;
END;
$$;

-- ===== Update stock-reduction trigger to floor at 0 =====
CREATE OR REPLACE FUNCTION public.reduce_stock_on_invoice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.product_id IS NULL THEN
        RETURN NEW;
    END IF;

    UPDATE public.products
    SET quantity = GREATEST(0, quantity - NEW.quantity)
    WHERE id = NEW.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (NEW.product_id, -NEW.quantity, 'out', 'Invoice sale', NEW.invoice_id, auth.uid());

    RETURN NEW;
END;
$$;

-- ===== Restore stock when invoice items are deleted =====
CREATE OR REPLACE FUNCTION public.restore_stock_on_invoice_item_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF OLD.product_id IS NULL THEN
        RETURN OLD;
    END IF;

    UPDATE public.products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (OLD.product_id, OLD.quantity, 'in', 'Invoice item removed/deleted', OLD.invoice_id, auth.uid());

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS restore_stock_on_invoice_item_delete ON public.invoice_items;
CREATE TRIGGER restore_stock_on_invoice_item_delete
AFTER DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_invoice_item_delete();
