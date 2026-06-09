---
name: GST Mode (Inclusive/Exclusive)
description: Per-invoice gst_mode toggle. Inclusive extracts GST from MRP; exclusive adds GST on top. Persisted in invoices.gst_mode.
type: feature
---
- Column `invoices.gst_mode` ('exclusive' | 'inclusive'), default 'exclusive', CHECK constraint.
- `useInvoiceCalculations(items, gstPct, gstMode)`:
  - Exclusive: gstAmount = subtotal * gst%, grandTotal = subtotal + gstAmount.
  - Inclusive: taxable = subtotal / (1 + gst%); gstAmount = subtotal - taxable; grandTotal = subtotal (GST already baked in).
- subtotal stored in DB is always sum of line_totals (MRP − discount per item), regardless of mode.
- ViewInvoiceDialog auto-heal of grand_total is mode-aware:
  - Inclusive: grand = subtotal + roundOff
  - Exclusive: grand = subtotal + gst + roundOff
- Toggle UI lives next to GST % field in Create + Edit; also rendered in totals section, preview, and PDF as "GST Mode: Inclusive/Exclusive".
- Inclusive mode adds a red "− GST Included" line above CGST/SGST in totals/preview/PDF.
