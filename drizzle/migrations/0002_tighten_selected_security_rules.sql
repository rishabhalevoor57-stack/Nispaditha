DO $fix_selected_rls$
DECLARE
  r record;
  v_predicate text := $policy$
    auth.uid() IS NOT NULL AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'branch_manager'::public.app_role)
      OR public.has_role(auth.uid(), 'sales_staff'::public.app_role)
      OR public.has_role(auth.uid(), 'technician'::public.app_role)
      OR public.has_role(auth.uid(), 'inventory_manager'::public.app_role)
      OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    )
  $policy$;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'activity_logs','branch_stock_transfers','branches','business_settings','buybacks',
        'categories','client_schemes','clients','custom_order_components','custom_order_items',
        'custom_order_payments','custom_orders','expenses','hidden_sold_entries','invoice_items',
        'invoice_payments','invoices','manual_sold_items','melting_entries','melting_items',
        'order_note_items','order_note_payments','order_notes','product_store_quantities','products',
        'rate_history','repair_items','return_exchange_items','return_exchanges','service_forms',
        'sku_registry','stock_deduction_blocks','stock_history','stock_transfers','store_wallets',
        'stores','suppliers','types_of_work','vendor_payments','wallet_transactions'
      ])
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    IF r.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', r.policyname, r.schemaname, r.tablename, v_predicate);
    ELSIF r.cmd IN ('UPDATE', 'ALL') THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)', r.policyname, r.schemaname, r.tablename, v_predicate, v_predicate);
    ELSE
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', r.policyname, r.schemaname, r.tablename, v_predicate);
    END IF;
  END LOOP;
END
$fix_selected_rls$;

ALTER POLICY "Authenticated users can update product images" ON storage.objects
  USING (bucket_id = 'product-images' AND owner_id = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'product-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Authenticated users can upload product images" ON storage.objects
  WITH CHECK (bucket_id = 'product-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Authenticated users can delete product images" ON storage.objects
  USING (bucket_id = 'product-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Anyone can view product images" ON storage.objects
  USING (bucket_id = 'product-images' AND owner_id = (SELECT auth.uid()::text));

ALTER POLICY "Authenticated users can upload order note images" ON storage.objects
  WITH CHECK (bucket_id = 'order-note-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Authenticated users can delete order note images" ON storage.objects
  USING (bucket_id = 'order-note-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Anyone can view order note images" ON storage.objects
  USING (bucket_id = 'order-note-images' AND owner_id = (SELECT auth.uid()::text));

ALTER POLICY "Authenticated can upload service form images" ON storage.objects
  WITH CHECK (bucket_id = 'service-form-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Authenticated can update service form images" ON storage.objects
  USING (bucket_id = 'service-form-images' AND owner_id = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'service-form-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Authenticated can delete service form images" ON storage.objects
  USING (bucket_id = 'service-form-images' AND owner_id = (SELECT auth.uid()::text));
ALTER POLICY "Public can view service form images" ON storage.objects
  USING (bucket_id = 'service-form-images' AND owner_id = (SELECT auth.uid()::text));

CREATE OR REPLACE FUNCTION public.prep_user_removal(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target_role text;
  v_super_count integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only a Super Admin can remove a user';
  END IF;

  IF p_target_user_id = v_caller THEN
    RAISE EXCEPTION 'You cannot remove your own account';
  END IF;

  SELECT role::text INTO v_target_role
  FROM public.user_roles WHERE user_id = p_target_user_id LIMIT 1;

  IF v_target_role = 'super_admin' THEN
    SELECT count(*) INTO v_super_count FROM public.user_roles WHERE role = 'super_admin';
    IF v_super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last Super Admin';
    END IF;
  END IF;

  -- Keep user-history cleanup explicit so stored catalog values never become executable SQL.
  UPDATE public.branch_transfers SET approved_by = NULL WHERE approved_by = p_target_user_id;
  UPDATE public.branch_transfers SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.branches SET manager_id = NULL WHERE manager_id = p_target_user_id;
  UPDATE public.expenses SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.expenses SET updated_by = NULL WHERE updated_by = p_target_user_id;
  UPDATE public.invoices SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.order_notes SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.order_notes SET handled_by = NULL WHERE handled_by = p_target_user_id;
  UPDATE public.rate_history SET changed_by = NULL WHERE changed_by = p_target_user_id;
  UPDATE public.stock_history SET created_by = NULL WHERE created_by = p_target_user_id;

  UPDATE public.activity_logs SET user_id = NULL WHERE user_id = p_target_user_id;
  UPDATE public.invoice_payments SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.order_note_payments SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.hidden_sold_entries SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.backups SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.custom_order_payments SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.calendar_events SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.manual_sold_items SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.return_exchanges SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.repair_items SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.melting_entries SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.sku_registry SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.service_forms SET created_by = NULL WHERE created_by = p_target_user_id;
  UPDATE public.stock_transfers SET transferred_by = NULL WHERE transferred_by = p_target_user_id;
  UPDATE public.branch_stock_transfers SET transferred_by = NULL WHERE transferred_by = p_target_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prep_user_removal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prep_user_removal(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_skus(
  p_type_of_work_id uuid,
  p_vendor_id uuid,
  p_category_id uuid,
  p_quantity integer,
  p_type_of_work_code text,
  p_vendor_code text,
  p_category_code text
)
RETURNS SETOF public.sku_registry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tw_code text := upper(trim(p_type_of_work_code));
  v_v_code text := upper(trim(p_vendor_code));
  v_c_code text := upper(trim(p_category_code));
  v_tw_name text;
  v_v_name text;
  v_c_name text;
  v_prefix text;
  v_next integer;
  v_count integer := 0;
  v_sku text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'staff'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'branch_manager'::public.app_role)
    OR public.has_role(v_uid, 'sales_staff'::public.app_role)
    OR public.has_role(v_uid, 'technician'::public.app_role)
    OR public.has_role(v_uid, 'inventory_manager'::public.app_role)
    OR public.has_role(v_uid, 'cashier'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'An active business account is required';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 1000 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 1000';
  END IF;
  IF v_tw_code = '' OR v_v_code = '' OR v_c_code = '' THEN
    RAISE EXCEPTION 'Type of work, vendor, and category codes are required';
  END IF;

  v_prefix := v_tw_code || v_v_code || v_c_code;
  SELECT name INTO v_tw_name FROM public.types_of_work WHERE id = p_type_of_work_id;
  SELECT name INTO v_v_name FROM public.suppliers WHERE id = p_vendor_id;
  SELECT name INTO v_c_name FROM public.categories WHERE id = p_category_id;

  IF p_type_of_work_id IS NOT NULL THEN
    UPDATE public.types_of_work SET code = v_tw_code WHERE id = p_type_of_work_id AND (code IS NULL OR code = '');
  END IF;
  IF p_vendor_id IS NOT NULL THEN
    UPDATE public.suppliers SET vendor_code = v_v_code WHERE id = p_vendor_id AND (vendor_code IS NULL OR vendor_code = '');
  END IF;
  IF p_category_id IS NOT NULL THEN
    UPDATE public.categories SET code = v_c_code WHERE id = p_category_id AND (code IS NULL OR code = '');
  END IF;

  PERFORM 1 FROM public.sku_registry WHERE prefix = v_prefix FOR UPDATE;
  SELECT COALESCE(MAX(running_number), 0) + 1 INTO v_next
  FROM public.sku_registry WHERE prefix = v_prefix;

  WHILE v_count < p_quantity LOOP
    v_sku := v_prefix || v_next::text;
    IF EXISTS (SELECT 1 FROM public.sku_registry WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.manual_sold_items WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.repair_items WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.return_exchange_items WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.custom_order_items WHERE sku = v_sku)
    THEN
      v_next := v_next + 1;
      CONTINUE;
    END IF;

    RETURN QUERY
    INSERT INTO public.sku_registry (
      sku, prefix, running_number, type_of_work_code, vendor_code, category_code,
      type_of_work_id, vendor_id, category_id, type_of_work_name, vendor_name,
      category_name, status, barcode_value, qr_payload, created_by
    ) VALUES (
      v_sku, v_prefix, v_next, v_tw_code, v_v_code, v_c_code,
      p_type_of_work_id, p_vendor_id, p_category_id, v_tw_name, v_v_name,
      v_c_name, 'generated', v_sku,
      jsonb_build_object(
        'sku', v_sku, 'vendor', v_v_name, 'category', v_c_name,
        'type_of_work', v_tw_name, 'created_at', now(), 'status', 'generated'
      ), v_uid
    ) RETURNING *;

    v_count := v_count + 1;
    v_next := v_next + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_skus(
  p_type_of_work_id uuid,
  p_vendor_id uuid,
  p_category_id uuid,
  p_quantity integer,
  p_type_of_work_code text,
  p_vendor_code text,
  p_category_code text,
  p_start_number integer DEFAULT NULL
)
RETURNS SETOF public.sku_registry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tw_code text := upper(trim(p_type_of_work_code));
  v_v_code text := upper(trim(p_vendor_code));
  v_c_code text := upper(trim(p_category_code));
  v_tw_name text;
  v_v_name text;
  v_c_name text;
  v_prefix text;
  v_next integer;
  v_count integer := 0;
  v_sku text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'staff'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'branch_manager'::public.app_role)
    OR public.has_role(v_uid, 'sales_staff'::public.app_role)
    OR public.has_role(v_uid, 'technician'::public.app_role)
    OR public.has_role(v_uid, 'inventory_manager'::public.app_role)
    OR public.has_role(v_uid, 'cashier'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'An active business account is required';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 1000 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 1000';
  END IF;
  IF v_tw_code = '' OR v_v_code = '' OR v_c_code = '' THEN
    RAISE EXCEPTION 'Type of work, vendor, and category codes are required';
  END IF;

  v_prefix := v_tw_code || v_v_code || v_c_code;
  SELECT name INTO v_tw_name FROM public.types_of_work WHERE id = p_type_of_work_id;
  SELECT name INTO v_v_name FROM public.suppliers WHERE id = p_vendor_id;
  SELECT name INTO v_c_name FROM public.categories WHERE id = p_category_id;

  IF p_type_of_work_id IS NOT NULL THEN
    UPDATE public.types_of_work SET code = v_tw_code WHERE id = p_type_of_work_id AND (code IS NULL OR code = '');
  END IF;
  IF p_vendor_id IS NOT NULL THEN
    UPDATE public.suppliers SET vendor_code = v_v_code WHERE id = p_vendor_id AND (vendor_code IS NULL OR vendor_code = '');
  END IF;
  IF p_category_id IS NOT NULL THEN
    UPDATE public.categories SET code = v_c_code WHERE id = p_category_id AND (code IS NULL OR code = '');
  END IF;

  PERFORM 1 FROM public.sku_registry WHERE prefix = v_prefix FOR UPDATE;
  IF p_start_number IS NOT NULL AND p_start_number > 0 THEN
    v_next := p_start_number;
  ELSE
    SELECT COALESCE(MAX(running_number), 0) + 1 INTO v_next
    FROM public.sku_registry WHERE prefix = v_prefix;
  END IF;

  WHILE v_count < p_quantity LOOP
    v_sku := v_prefix || v_next::text;
    IF EXISTS (SELECT 1 FROM public.sku_registry WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.manual_sold_items WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.repair_items WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.return_exchange_items WHERE sku = v_sku)
       OR EXISTS (SELECT 1 FROM public.custom_order_items WHERE sku = v_sku)
    THEN
      v_next := v_next + 1;
      CONTINUE;
    END IF;

    RETURN QUERY
    INSERT INTO public.sku_registry (
      sku, prefix, running_number, type_of_work_code, vendor_code, category_code,
      type_of_work_id, vendor_id, category_id, type_of_work_name, vendor_name,
      category_name, status, barcode_value, qr_payload, created_by
    ) VALUES (
      v_sku, v_prefix, v_next, v_tw_code, v_v_code, v_c_code,
      p_type_of_work_id, p_vendor_id, p_category_id, v_tw_name, v_v_name,
      v_c_name, 'generated', v_sku,
      jsonb_build_object(
        'sku', v_sku, 'vendor', v_v_name, 'category', v_c_name,
        'type_of_work', v_tw_name, 'created_at', now(), 'status', 'generated'
      ), v_uid
    ) RETURNING *;

    v_count := v_count + 1;
    v_next := v_next + 1;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_skus(uuid, uuid, uuid, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_skus(uuid, uuid, uuid, integer, text, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.generate_skus(uuid, uuid, uuid, integer, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_skus(uuid, uuid, uuid, integer, text, text, text, integer) TO authenticated, service_role;

ALTER FUNCTION public.transfer_product_to_branch(uuid, uuid, integer, timestamp with time zone, text) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.transfer_product_to_branch(uuid, uuid, integer, timestamp with time zone, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_product_to_branch(uuid, uuid, integer, timestamp with time zone, text) TO authenticated, service_role;

ALTER FUNCTION public.process_buyback(uuid, uuid, text, text, text, numeric, numeric, numeric, numeric, text, text, text, jsonb) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.process_buyback(uuid, uuid, text, text, text, numeric, numeric, numeric, numeric, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_buyback(uuid, uuid, text, text, text, numeric, numeric, numeric, numeric, text, text, text, jsonb) TO authenticated, service_role;