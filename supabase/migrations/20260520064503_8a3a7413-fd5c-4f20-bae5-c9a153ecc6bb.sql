ALTER TABLE public.return_exchanges DROP CONSTRAINT IF EXISTS return_exchanges_type_check;
ALTER TABLE public.return_exchanges
  ADD CONSTRAINT return_exchanges_type_check
  CHECK (type = ANY (ARRAY['return'::text, 'exchange'::text, 'buyback'::text]));

CREATE TABLE IF NOT EXISTS public.buybacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id),
  invoice_ref text,
  type text NOT NULL,
  metal_type text,
  weight numeric NOT NULL DEFAULT 0,
  rate_used numeric NOT NULL DEFAULT 0,
  round_off numeric NOT NULL DEFAULT 0,
  total_credits_added numeric NOT NULL DEFAULT 0,
  reason text,
  notes text,
  destination text NOT NULL DEFAULT 'repair',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buybacks_type_check CHECK (type = ANY (ARRAY['jewellery'::text, 'metal'::text])),
  CONSTRAINT buybacks_destination_check CHECK (destination = ANY (ARRAY['repair'::text]))
);

ALTER TABLE public.buybacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view buybacks" ON public.buybacks;
CREATE POLICY "Authenticated users can view buybacks"
ON public.buybacks
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create buybacks" ON public.buybacks;
CREATE POLICY "Authenticated users can create buybacks"
ON public.buybacks
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update buybacks" ON public.buybacks;
CREATE POLICY "Authenticated users can update buybacks"
ON public.buybacks
FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can delete buybacks" ON public.buybacks;
CREATE POLICY "Admins can delete buybacks"
ON public.buybacks
FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_buybacks_client_id ON public.buybacks(client_id);
CREATE INDEX IF NOT EXISTS idx_buybacks_created_at ON public.buybacks(created_at DESC);

ALTER TABLE public.repair_items
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_ref_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'repair_items_client_id_fkey'
      AND conrelid = 'public.repair_items'::regclass
  ) THEN
    ALTER TABLE public.repair_items
      ADD CONSTRAINT repair_items_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id);
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_mode_1 text,
  ADD COLUMN IF NOT EXISTS payment_amount_1 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_mode_2 text,
  ADD COLUMN IF NOT EXISTS payment_amount_2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_payment_label text;

CREATE TABLE IF NOT EXISTS public.hidden_sold_entries (
  entry_key text PRIMARY KEY,
  source text NOT NULL,
  source_ref text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT hidden_sold_entries_source_check CHECK (source = ANY (ARRAY['invoice'::text, 'custom_order'::text, 'manual'::text]))
);

ALTER TABLE public.hidden_sold_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view hidden sold entries" ON public.hidden_sold_entries;
CREATE POLICY "Authenticated users can view hidden sold entries"
ON public.hidden_sold_entries
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create hidden sold entries" ON public.hidden_sold_entries;
CREATE POLICY "Authenticated users can create hidden sold entries"
ON public.hidden_sold_entries
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can remove hidden sold entries" ON public.hidden_sold_entries;
CREATE POLICY "Authenticated users can remove hidden sold entries"
ON public.hidden_sold_entries
FOR DELETE
TO authenticated
USING (true);

DROP TRIGGER IF EXISTS reduce_stock_on_invoice_item ON public.invoice_items;

CREATE OR REPLACE FUNCTION public.process_buyback(
  p_client_id uuid,
  p_invoice_id uuid DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_kind text DEFAULT 'jewellery',
  p_metal_type text DEFAULT 'silver',
  p_weight numeric DEFAULT 0,
  p_rate_used numeric DEFAULT 0,
  p_round_off numeric DEFAULT 0,
  p_total_credits_added numeric DEFAULT 0,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_destination text DEFAULT 'repair',
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_buyback_id uuid;
  v_return_exchange_id uuid;
  v_reference_number text;
  v_client public.clients%ROWTYPE;
  v_item jsonb;
  v_wallet_balance numeric;
  v_product_name text;
  v_weight numeric;
  v_quantity integer;
  v_line_total numeric;
  v_rate numeric;
  v_sku text;
  v_product_id uuid;
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client is required for buyback';
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Selected client was not found';
  END IF;

  IF COALESCE(p_kind, '') NOT IN ('jewellery', 'metal') THEN
    RAISE EXCEPTION 'Invalid buyback type';
  END IF;

  IF COALESCE(p_destination, 'repair') <> 'repair' THEN
    RAISE EXCEPTION 'Invalid buyback destination';
  END IF;

  IF COALESCE(p_total_credits_added, 0) <= 0 THEN
    RAISE EXCEPTION 'Buyback total must be greater than zero';
  END IF;

  IF COALESCE(jsonb_array_length(p_items), 0) = 0 THEN
    RAISE EXCEPTION 'At least one buyback item is required';
  END IF;

  INSERT INTO public.buybacks (
    client_id,
    invoice_ref,
    type,
    metal_type,
    weight,
    rate_used,
    round_off,
    total_credits_added,
    reason,
    notes,
    destination
  ) VALUES (
    p_client_id,
    p_invoice_number,
    p_kind,
    p_metal_type,
    COALESCE(p_weight, 0),
    COALESCE(p_rate_used, 0),
    COALESCE(p_round_off, 0),
    COALESCE(p_total_credits_added, 0),
    p_reason,
    p_notes,
    COALESCE(p_destination, 'repair')
  )
  RETURNING id INTO v_buyback_id;

  SELECT public.generate_return_exchange_reference('return') INTO v_reference_number;

  INSERT INTO public.return_exchanges (
    reference_number,
    type,
    buyback_kind,
    original_invoice_id,
    original_invoice_number,
    client_id,
    client_name,
    client_phone,
    refund_amount,
    additional_charge,
    payment_mode,
    refund_method,
    disposition,
    live_rate_used,
    round_off,
    total_weight,
    metal_type,
    reason,
    notes,
    created_by
  ) VALUES (
    v_reference_number,
    'buyback',
    p_kind,
    p_invoice_id,
    p_invoice_number,
    p_client_id,
    v_client.name,
    v_client.phone,
    COALESCE(p_total_credits_added, 0),
    0,
    'store_credit',
    'store_credit',
    COALESCE(p_destination, 'repair'),
    COALESCE(p_rate_used, 0),
    COALESCE(p_round_off, 0),
    COALESCE(p_weight, 0),
    p_metal_type,
    p_reason,
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_return_exchange_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_name := COALESCE(
      NULLIF(v_item->>'product_name', ''),
      trim(COALESCE(p_metal_type, 'Metal') || ' ' || COALESCE(v_item->>'weight_grams', '0') || 'g')
    );
    v_weight := COALESCE(NULLIF(v_item->>'weight_grams', '')::numeric, 0);
    v_quantity := GREATEST(COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1), 1);
    v_rate := COALESCE(NULLIF(v_item->>'rate_per_gram', '')::numeric, p_rate_used, 0);
    v_line_total := COALESCE(
      NULLIF(v_item->>'total', '')::numeric,
      NULLIF(v_item->>'line_total', '')::numeric,
      v_weight * v_quantity * v_rate,
      0
    );
    v_sku := NULLIF(v_item->>'sku', '');
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;

    INSERT INTO public.return_exchange_items (
      return_exchange_id,
      direction,
      product_id,
      product_name,
      sku,
      category,
      quantity,
      weight_grams,
      rate_per_gram,
      making_charges,
      discount,
      line_total,
      gst_percentage,
      gst_amount,
      total
    ) VALUES (
      v_return_exchange_id,
      'returned',
      v_product_id,
      v_product_name,
      v_sku,
      NULLIF(v_item->>'category', ''),
      v_quantity,
      v_weight,
      v_rate,
      0,
      0,
      v_line_total,
      0,
      0,
      v_line_total
    );

    INSERT INTO public.repair_items (
      product_id,
      sku,
      product_name,
      weight_grams,
      quantity,
      original_invoice_id,
      original_invoice_number,
      client_id,
      client_name,
      client_phone,
      source,
      source_reference_id,
      source_type,
      source_ref_id,
      status,
      date_sent,
      notes,
      created_by,
      metal_type,
      rate_used,
      amount_credited
    ) VALUES (
      v_product_id,
      v_sku,
      v_product_name,
      v_weight,
      v_quantity,
      p_invoice_id,
      p_invoice_number,
      p_client_id,
      v_client.name,
      v_client.phone,
      'buyback',
      v_buyback_id,
      'buyback',
      v_buyback_id,
      'in_repair',
      now(),
      COALESCE(NULLIF(v_item->>'notes', ''), p_notes),
      auth.uid(),
      p_metal_type,
      v_rate,
      v_line_total
    );
  END LOOP;

  v_wallet_balance := public.adjust_wallet_balance(
    p_client_id,
    COALESCE(p_total_credits_added, 0),
    'credit',
    'buyback',
    v_buyback_id,
    v_reference_number,
    COALESCE(p_notes, p_reason)
  );

  RETURN jsonb_build_object(
    'buyback_id', v_buyback_id,
    'return_exchange_id', v_return_exchange_id,
    'reference_number', v_reference_number,
    'wallet_balance', v_wallet_balance
  );
END;
$$;