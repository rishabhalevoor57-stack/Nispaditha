
-- 1) Repair grand_total: correct = subtotal + gst_amount + round_off
--    (stored subtotal is already net of discount; the previous auto-heal subtracted discount again)
UPDATE public.invoices
SET grand_total = ROUND((COALESCE(subtotal,0) + COALESCE(gst_amount,0) + COALESCE(round_off,0))::numeric, 2)
WHERE ABS(COALESCE(grand_total,0) - (COALESCE(subtotal,0) + COALESCE(gst_amount,0) + COALESCE(round_off,0))) > 0.05;

-- 2) Recompute payment_status from real payments + store credits vs corrected grand_total
WITH pay AS (
  SELECT i.id,
         i.grand_total,
         COALESCE(i.store_credits_used, 0)
           + COALESCE((SELECT SUM(amount) FROM public.invoice_payments p WHERE p.invoice_id = i.id), 0)
           AS paid_sum,
         i.status
  FROM public.invoices i
)
UPDATE public.invoices i
SET payment_status = CASE
    WHEN pay.status = 'draft' THEN 'pending'
    WHEN pay.paid_sum <= 0 THEN 'pending'
    WHEN (pay.grand_total - pay.paid_sum) <= 0.05 THEN 'paid'
    ELSE 'partial'
  END
FROM pay
WHERE pay.id = i.id;
