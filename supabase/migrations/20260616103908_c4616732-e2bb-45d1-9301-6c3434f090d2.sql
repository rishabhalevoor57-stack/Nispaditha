
DROP POLICY IF EXISTS "sku_registry_admin_delete" ON public.sku_registry;
CREATE POLICY "sku_registry_admin_delete" ON public.sku_registry
FOR DELETE TO authenticated
USING (public.is_admin());
