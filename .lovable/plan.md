
# Complete In-House Custom Order & Components Workflow

This is a large, multi-part change. It touches the database, custom-order form, components table, items table, inventory form, and the Custom Orders page. Existing customer orders, invoices, PDFs, GST, and payments will not be altered.

## Scope (mapped to your 15 sections)

1. **Component inventory deduction on Send to Inventory** — done inside a single DB function, atomic, runs exactly once
2. **Components support Qty + Weight + Strings** simultaneously (per row, whichever fields apply based on linked inventory item)
3. **Customer Orders get the same dual Qty/Strings fields** in customer-supplied materials and components
4. **Beads & Pearls inventory finalized** — Title, SKU (optional/auto), Description, Vendor, Buying Price, Selling Price, Date of Purchase, Quantity, Strings; hide legacy "Pearls" category from dropdowns
5. **Total Finished Weight** auto-summed from weight-based components only (excludes beads/strings/labour), displayed near Pricing Summary and stored on the finished product
6. **Send to Inventory** persists: total_weight, selling price, buying price, sku, title, description, images, vendor, date of making
7. **Pricing rule** — components use live dashboard silver rate during build; the finished inventory product is stamped `is_list_price=true` with a frozen selling price. Invoice logic already respects list-price items — no invoice changes
8. **Components table columns**: SKU · Component · Category · Available Stock · Weight Used · Qty Used · Strings Used · Buying Cost · Remove. Fields grey out based on the inventory category of the linked SKU
9. **Multiple images** — real multi-file uploader (product-images bucket), preview grid, remove per image
10. **Filters** on Custom Orders page: All / Customer / In-House tabs
11. **Search** by SKU, product name, vendor, description (works on both order types)
12. **UI reorg** for In-House form: Product Details · Manufacturing (Items, Components, Charges) · Component Summary (live totals) · Pricing · Send to Inventory
13. **Validations** before Send to Inventory: unique SKU, required fields, sufficient stock for every component, no negative results
14. **Invoices untouched** — no edits to invoice components, PDF, GST logic, or preview
15. **Perf** — inventory picker uses trigram search + limit(20), deduction runs server-side in one RPC

## Technical breakdown

### DB migration (one migration)
- Add `product_id`, `strings_used`, `unit` (weight_based|quantity|strings) columns to `custom_order_components`
- New RPC `send_custom_order_to_inventory_v2(p_custom_order_id, p_final_quantity)`:
  - Validates order type = in_house, not already stocked
  - Validates SKU uniqueness
  - Iterates components with `product_id`, locks source rows, checks stock (qty / weight / strings depending on unit), raises on shortfall
  - Deducts from `products.quantity`, `products.weight_grams`, or `products.strings_count`
  - Writes `stock_history` rows for each deduction
  - Creates finished product with `is_list_price=true`, `weight_grams` = sum of weight_based components, `pricing_mode='flat_price'`, frozen `selling_price`, `image_url` = first image
  - Marks order `inventory_product_id`
- Keep old `send_custom_order_to_inventory` intact for backward compatibility
- Backfill: nothing destructive; existing "Pearls" rows stay but category is filtered out of pickers (already migrated to Beads & Pearls earlier)

### Frontend
- Rewrite `CustomOrderComponentsTable.tsx` — SKU picker, dynamic columns, live totals footer (Total Weight, Total Qty, Total Strings, Total Cost)
- Extend `CustomOrderItemsTable.tsx` — expose `strings_used` for Beads & Pearls rows (customer orders too)
- Restructure `CustomOrderFormDialog.tsx` into sectioned cards for in-house mode; add Component Summary card; add multi-image uploader; add Send-to-Inventory guard/validations; call new RPC
- `CustomOrders.tsx` — add tabs (All/Customer/In-House) + search box across sku/title/vendor/description
- `ProductFormDialog.tsx` — for Beads & Pearls category show both Quantity and Strings fields; already have `strings_count` column
- Hide "Pearls" category from category dropdowns (filter by name)

### Files
```text
supabase/migrations/<new>.sql                                  new
src/types/customOrder.ts                                       edit (component fields)
src/hooks/useCustomOrders.ts                                   edit (persist new component fields, RPC call)
src/components/custom-orders/CustomOrderComponentsTable.tsx    rewrite
src/components/custom-orders/CustomOrderItemsTable.tsx         edit (strings_used field for beads)
src/components/custom-orders/CustomOrderFormDialog.tsx         edit (sections, multi-image, totals, RPC)
src/components/custom-orders/CustomOrderTable.tsx              edit (order type badge column)
src/pages/CustomOrders.tsx                                     edit (tabs + search)
src/components/inventory/ProductFormDialog.tsx                 edit (Beads & Pearls dual fields)
src/integrations/supabase/types.ts                             regenerated after migration
```

## What stays exactly as-is
- Invoice creation, edit, PDF, GST, payment, preview
- Customer Order pricing math (only the components/materials rows get an extra Strings field)
- Existing custom orders already sent to inventory
- SKU generator, Sold, Repairs, Returns, Reports

## Rollout order in this thread
1. Migration (needs your approval) — creates RPC + schema additions
2. Once approved and types regenerate: all frontend edits in one batch
3. Quick smoke: create in-house order → add 2 component SKUs → Send to Inventory → verify stock deduction, new product weight, list-price flag

Reply **"go"** to run the migration and proceed with the frontend, or tell me which sections to trim.
