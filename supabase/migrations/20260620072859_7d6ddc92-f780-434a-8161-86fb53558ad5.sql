-- Backfill invoice line items for invoices that were converted from a custom order
-- but ended up with zero invoice_items rows.
DO $$
DECLARE
  v_inv RECORD;
  v_co  RECORD;
  v_comp RECORD;
  v_qty INTEGER;
  v_wt NUMERIC;
  v_rate NUMERIC;
  v_total NUMERIC;
  v_is_weight BOOLEAN;
BEGIN
  FOR v_inv IN
    SELECT i.id AS invoice_id, i.notes
    FROM public.invoices i
    WHERE i.notes ILIKE 'Converted from Custom Order %'
      AND NOT EXISTS (SELECT 1 FROM public.invoice_items ii WHERE ii.invoice_id = i.id)
  LOOP
    -- Pull the source custom order using the reference code in the notes
    SELECT * INTO v_co
    FROM public.custom_orders co
    WHERE co.converted_to_invoice_id = v_inv.invoice_id
       OR position(co.reference_number in v_inv.notes) > 0
    ORDER BY co.created_at DESC
    LIMIT 1;

    IF v_co.id IS NULL THEN CONTINUE; END IF;

    -- (a) Components → priced line items
    FOR v_comp IN
      SELECT * FROM public.custom_order_components WHERE custom_order_id = v_co.id ORDER BY created_at
    LOOP
      v_qty := GREATEST(COALESCE(v_comp.quantity, 1), 1);
      v_wt  := COALESCE(v_comp.weight_grams, 0);
      v_rate := COALESCE(v_comp.rate_per_gram, 0);
      v_total := COALESCE(v_comp.total, 0);
      v_is_weight := (v_rate > 0 AND v_wt > 0);

      INSERT INTO public.invoice_items (
        invoice_id, product_id, product_name, category,
        quantity, weight_grams, rate_per_gram, gold_value,
        making_charges, discount, discounted_making,
        subtotal, gst_percentage, gst_amount, total, mrp, description
      ) VALUES (
        v_inv.invoice_id, NULL,
        v_comp.component_name || COALESCE(' (' || v_comp.material || ')', ''),
        'Component',
        v_qty,
        CASE WHEN v_is_weight THEN v_wt ELSE 0 END,
        CASE WHEN v_is_weight THEN v_rate ELSE 0 END,
        CASE WHEN v_is_weight THEN v_wt * v_rate * v_qty ELSE 0 END,
        0, 0, 0,
        v_total, 0, 0, v_total,
        CASE WHEN v_is_weight THEN 0 ELSE v_total END,
        NULL
      );
    END LOOP;

    -- (b) Charges → flat-price line items
    IF COALESCE(v_co.making_charges, 0) > 0 THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      VALUES (v_inv.invoice_id, 'Making Charges', 'Service Charge', 1, 0, 0, 0, 0, 0, 0, v_co.making_charges, 0, 0, v_co.making_charges, v_co.making_charges);
    END IF;
    IF COALESCE(v_co.design_charges, 0) > 0 THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      VALUES (v_inv.invoice_id, 'Design Charges', 'Service Charge', 1, 0, 0, 0, 0, 0, 0, v_co.design_charges, 0, 0, v_co.design_charges, v_co.design_charges);
    END IF;
    IF COALESCE(v_co.labour_charges, 0) > 0 THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      VALUES (v_inv.invoice_id, 'Labour Charges', 'Service Charge', 1, 0, 0, 0, 0, 0, 0, v_co.labour_charges, 0, 0, v_co.labour_charges, v_co.labour_charges);
    END IF;
    IF COALESCE(v_co.polishing_charges, 0) > 0 THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      VALUES (v_inv.invoice_id, 'Polishing Charges', 'Service Charge', 1, 0, 0, 0, 0, 0, 0, v_co.polishing_charges, 0, 0, v_co.polishing_charges, v_co.polishing_charges);
    END IF;
    IF COALESCE(v_co.repair_charges, 0) > 0 THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      VALUES (v_inv.invoice_id, 'Repair Charges', 'Service Charge', 1, 0, 0, 0, 0, 0, 0, v_co.repair_charges, 0, 0, v_co.repair_charges, v_co.repair_charges);
    END IF;
    IF COALESCE(v_co.additional_charge, 0) > 0 THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      VALUES (v_inv.invoice_id, COALESCE(NULLIF(v_co.additional_charge_label,''), 'Additional Charge'), 'Service Charge', 1, 0, 0, 0, 0, 0, 0, v_co.additional_charge, 0, 0, v_co.additional_charge, v_co.additional_charge);
    END IF;

    -- (c) Extra charges JSONB array
    IF v_co.extra_charges IS NOT NULL AND jsonb_typeof(v_co.extra_charges) = 'array' THEN
      INSERT INTO public.invoice_items (invoice_id, product_name, category, quantity, weight_grams, rate_per_gram, gold_value, making_charges, discount, discounted_making, subtotal, gst_percentage, gst_amount, total, mrp)
      SELECT v_inv.invoice_id,
             COALESCE(NULLIF(elem->>'label',''), 'Extra Charge'),
             'Service Charge', 1, 0, 0, 0, 0, 0, 0,
             COALESCE((elem->>'amount')::numeric, 0), 0, 0,
             COALESCE((elem->>'amount')::numeric, 0),
             COALESCE((elem->>'amount')::numeric, 0)
      FROM jsonb_array_elements(v_co.extra_charges) AS elem
      WHERE COALESCE((elem->>'amount')::numeric, 0) > 0;
    END IF;
  END LOOP;
END $$;