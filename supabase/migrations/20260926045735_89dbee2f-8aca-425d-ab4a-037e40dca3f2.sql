CREATE POLICY "Authenticated can replace editable custom order components"
ON public.custom_order_components
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.custom_orders co
    WHERE co.id = custom_order_components.custom_order_id
      AND co.status <> 'cancelled'
      AND (co.branch_id IS NULL OR public.user_can_access_branch(co.branch_id))
  )
);

ALTER FUNCTION public.replace_custom_order_lines(uuid, jsonb, jsonb) SECURITY INVOKER;