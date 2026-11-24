DROP INDEX IF EXISTS public.products_sku_active_unique;

CREATE UNIQUE INDEX products_sku_branch_active_unique
  ON public.products (sku, branch_id)
  WHERE deleted_at IS NULL AND branch_id IS NOT NULL;

CREATE UNIQUE INDEX products_sku_unassigned_active_unique
  ON public.products (sku)
  WHERE deleted_at IS NULL AND branch_id IS NULL;