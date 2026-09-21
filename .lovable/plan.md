# Custom Order Billing and GST Conversion Fix

## What will change
- Redesign the Custom Order delivery bill into one compact, consistent details table with category rows for order items, customer-supplied items, and components.
- Persist component discounts and show item/component discounts on their own rows; keep the flat order discount separate.
- Keep Custom Order totals consistent through save, edit, print, download, and GST conversion.
- Remove duplicate Custom Order summary blocks from GST invoice preview/PDF while retaining all billable rows in the main invoice table.
- Change “Open GST Invoice” into an unsaved prefilled invoice form. Create the invoice only after the user explicitly submits it.
- Make conversion idempotent and prevent conversion/open/preview actions from creating payments.
- Inspect existing duplicate conversion payments and remove only exact bug-caused duplicates where the evidence is unambiguous.

## Technical details
- Add component discount fields to the existing component records through one database migration.
- Extend Custom Order save/load and the embedded conversion payload with component discounts.
- Reuse the existing invoice form’s prefill flow rather than inserting a draft invoice during conversion.
- Preserve the centralized signed round-off calculation unchanged.
- Keep stock, inventory, reports, dashboard, service forms, repairs, melting, returns, vendors, and expenses untouched.

## Validation
- Verify item, component, and flat discounts independently and together.
- Verify opening and reopening conversion creates no invoice or payment.
- Verify final submission creates one invoice and transfers each genuine advance once.
- Verify preview and PDF contain one main bill table without repeated order/component summaries.
