
CREATE TABLE public.order_note_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_note_id UUID NOT NULL REFERENCES public.order_notes(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_note_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order note payments"
  ON public.order_note_payments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order note payments"
  ON public.order_note_payments FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order note payments"
  ON public.order_note_payments FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins can delete order note payments"
  ON public.order_note_payments FOR DELETE TO authenticated
  USING (public.is_admin());
