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
  r record;
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

  -- Detach every business-history reference to this user so the account can be deleted.
  FOR r IN
    SELECT c.relname AS table_name, a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
      AND n.nspname = 'public'
      AND c.relname NOT IN ('profiles', 'user_roles')
      AND t.typname = 'uuid'
  LOOP
    EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I = $1', r.table_name, r.column_name, r.column_name)
    USING p_target_user_id;
  END LOOP;

  -- Audit columns that store user ids without a foreign key.
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

GRANT EXECUTE ON FUNCTION public.prep_user_removal(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.prep_user_removal(uuid) FROM anon;