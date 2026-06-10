
-- Extend expenses for Labour / Stock Purchase / Other tracking + audit
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS quantity numeric(12,3),
  ADD COLUMN IF NOT EXISTS weight_grams numeric(12,3),
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS edit_reason text;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_expense_type_check
  CHECK (expense_type IN ('labour','stock_purchase','other'));

CREATE INDEX IF NOT EXISTS expenses_expense_type_idx ON public.expenses(expense_type);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON public.expenses(expense_date);
