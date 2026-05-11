
-- Manual sold items table (for items added directly to Sold page)
CREATE TABLE IF NOT EXISTS public.manual_sold_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sold_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid,
  product_name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  weight_grams numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  client_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_sold_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view manual sold items"
  ON public.manual_sold_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert manual sold items"
  ON public.manual_sold_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update manual sold items"
  ON public.manual_sold_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete manual sold items"
  ON public.manual_sold_items FOR DELETE TO authenticated USING (is_admin());

-- Trigger: decrement inventory on insert
CREATE OR REPLACE FUNCTION public.reduce_stock_on_manual_sold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET quantity = GREATEST(0, quantity - NEW.quantity) WHERE id = NEW.product_id;
    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (NEW.product_id, -NEW.quantity, 'out', 'Manual sold entry', NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_reduce_stock_on_manual_sold
AFTER INSERT ON public.manual_sold_items
FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_manual_sold();

-- Trigger: restore inventory on delete
CREATE OR REPLACE FUNCTION public.restore_stock_on_manual_sold_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.product_id IS NOT NULL THEN
    UPDATE public.products SET quantity = quantity + OLD.quantity WHERE id = OLD.product_id;
    INSERT INTO public.stock_history (product_id, quantity_change, type, reason, reference_id, created_by)
    VALUES (OLD.product_id, OLD.quantity, 'in', 'Manual sold entry removed', OLD.id, auth.uid());
  END IF;
  RETURN OLD;
END;$$;

CREATE TRIGGER trg_restore_stock_on_manual_sold_delete
AFTER DELETE ON public.manual_sold_items
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_manual_sold_delete();
