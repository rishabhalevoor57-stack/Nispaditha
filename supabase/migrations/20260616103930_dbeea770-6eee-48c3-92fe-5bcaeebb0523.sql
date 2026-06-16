
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
  v_v_code  text := upper(trim(p_vendor_code));
  v_c_code  text := upper(trim(p_category_code));
  v_tw_name text; v_v_name text; v_c_name text;
  v_prefix  text;
  v_next    integer;
  v_count   integer := 0;
  v_sku     text;
  v_uid     uuid := auth.uid();
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 1000 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 1000';
  END IF;
  IF v_tw_code = '' OR v_v_code = '' OR v_c_code = '' THEN
    RAISE EXCEPTION 'Type of work, vendor, and category codes are required';
  END IF;

  v_prefix := v_tw_code || v_v_code || v_c_code;

  SELECT name INTO v_tw_name FROM public.types_of_work WHERE id = p_type_of_work_id;
  SELECT name INTO v_v_name  FROM public.suppliers     WHERE id = p_vendor_id;
  SELECT name INTO v_c_name  FROM public.categories    WHERE id = p_category_id;

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
      sku, prefix, running_number,
      type_of_work_code, vendor_code, category_code,
      type_of_work_id, vendor_id, category_id,
      type_of_work_name, vendor_name, category_name,
      status, barcode_value, qr_payload, created_by
    ) VALUES (
      v_sku, v_prefix, v_next,
      v_tw_code, v_v_code, v_c_code,
      p_type_of_work_id, p_vendor_id, p_category_id,
      v_tw_name, v_v_name, v_c_name,
      'generated', v_sku,
      jsonb_build_object(
        'sku', v_sku, 'vendor', v_v_name, 'category', v_c_name,
        'type_of_work', v_tw_name, 'created_at', now(), 'status', 'generated'
      ),
      v_uid
    )
    RETURNING *;

    v_count := v_count + 1;
    v_next := v_next + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_skus(uuid, uuid, uuid, integer, text, text, text, integer) TO authenticated;
