
-- 1. Log table for blocked stock deduction attempts
CREATE TABLE IF NOT EXISTS public.stock_deduction_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  invoice_number text,
  invoice_status text,
  product_id uuid,
  product_name text,
  attempted_quantity integer NOT NULL DEFAULT 0,
  current_stock integer,
  reason text NOT NULL,
  attempted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stock_deduction_blocks TO authenticated;
GRANT ALL ON public.stock_deduction_blocks TO service_role;

ALTER TABLE public.stock_deduction_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view block log"
  ON public.stock_deduction_blocks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "System can insert block log"
  ON public.stock_deduction_blocks FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can delete block log"
  ON public.stock_deduction_blocks FOR DELETE
  TO authenticated USING (is_admin());

-- 2. Replace trigger function to validate invoice status before deduction
CREATE OR REPLACE FUNCTION public.reduce_stock_on_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    inv_status text;
    inv_number text;
    prod_name text;
    prod_qty integer;
BEGIN
    IF NEW.product_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status, invoice_number INTO inv_status, inv_number
    FROM public.invoices WHERE id = NEW.invoice_id;

    -- Only deduct stock for Saved (sent) or Completed (paid) invoices
    IF inv_status IS DISTINCT FROM 'sent' AND inv_status IS DISTINCT FROM 'paid' THEN
        SELECT name, quantity INTO prod_name, prod_qty
        FROM public.products WHERE id = NEW.product_id;

        INSERT INTO public.stock_deduction_blocks (
            invoice_id, invoice_number, invoice_status,
            product_id, product_name, attempted_quantity, current_stock,
            reason, attempted_by
        ) VALUES (
            NEW.invoice_id, inv_number, COALESCE(inv_status, 'unknown'),
            NEW.product_id, prod_name, NEW.quantity, prod_qty,
            'Stock deduction blocked: invoice status "' || COALESCE(inv_status, 'unknown') ||
            '" is not Saved/Completed',
            auth.uid()
        );
        RETURN NEW;
    END IF;

    UPDATE public.products
    SET quantity = GREATEST(0, quantity - NEW.quantity)
    WHERE id = NEW.product_id;

    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (NEW.product_id, -NEW.quantity, 'out', 'Invoice sale', NEW.invoice_id, auth.uid());

    RETURN NEW;
END;
$function$;
