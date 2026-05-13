
-- ============ store_wallets ============
CREATE TABLE IF NOT EXISTS public.store_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view store wallets" ON public.store_wallets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert store wallets" ON public.store_wallets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update store wallets" ON public.store_wallets
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete store wallets" ON public.store_wallets
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER store_wallets_updated_at
  BEFORE UPDATE ON public.store_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ wallet_transactions ============
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric NOT NULL DEFAULT 0,
  source text NOT NULL CHECK (source IN ('return','exchange','buyback','manual','invoice','invoice_refund','cancel_refund')),
  reference_id uuid,
  reference_label text,
  notes text,
  balance_after numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert wallet transactions" ON public.wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete wallet transactions" ON public.wallet_transactions
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_wallet_tx_client ON public.wallet_transactions(client_id, created_at DESC);

-- ============ repair_items ============
CREATE TABLE IF NOT EXISTS public.repair_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  sku text,
  product_name text NOT NULL,
  weight_grams numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  original_invoice_id uuid,
  original_invoice_number text,
  client_name text,
  client_phone text,
  source text NOT NULL CHECK (source IN ('return','exchange','buyback','manual')),
  source_reference_id uuid,
  status text NOT NULL DEFAULT 'in_repair' CHECK (status IN ('in_repair','sent_to_inventory')),
  date_sent timestamptz NOT NULL DEFAULT now(),
  date_resolved timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.repair_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view repair items" ON public.repair_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert repair items" ON public.repair_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update repair items" ON public.repair_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete repair items" ON public.repair_items
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER repair_items_updated_at
  BEFORE UPDATE ON public.repair_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ invoices: cancel + credits columns ============
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS store_credits_used numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- ============ return_exchanges: buyback + disposition ============
ALTER TABLE public.return_exchanges
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS refund_method text NOT NULL DEFAULT 'store_credit',
  ADD COLUMN IF NOT EXISTS disposition text NOT NULL DEFAULT 'inventory',
  ADD COLUMN IF NOT EXISTS live_rate_used numeric,
  ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_weight numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_id uuid;

-- ============ helper RPCs for wallet ============
CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(
  p_client_id uuid,
  p_delta numeric,
  p_type text,
  p_source text,
  p_reference_id uuid,
  p_reference_label text,
  p_notes text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  INSERT INTO public.store_wallets (client_id, balance)
  VALUES (p_client_id, GREATEST(0, p_delta))
  ON CONFLICT (client_id)
  DO UPDATE SET balance = public.store_wallets.balance + p_delta,
                updated_at = now()
  RETURNING balance INTO new_balance;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient store wallet balance';
  END IF;

  INSERT INTO public.wallet_transactions
    (client_id, type, amount, source, reference_id, reference_label, notes, balance_after, created_by)
  VALUES
    (p_client_id, p_type, ABS(p_delta), p_source, p_reference_id, p_reference_label, p_notes, new_balance, auth.uid());

  RETURN new_balance;
END;
$$;
