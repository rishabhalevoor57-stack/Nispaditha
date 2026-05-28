# Plan: Custom Order Components + Service Form Rework

This is a large, two-part feature. Below is the implementation plan. Both changes touch DB schema, so I want your approval before running migrations.

---

## CHANGE 1 — Custom Order: Components Section + Editable GST

### Database
New table `custom_order_components`:
- `custom_order_id` (FK to custom_orders)
- `component_name`, `material`, `weight_grams`, `quantity`, `unit_price`, `total`
- standard timestamps + RLS (same pattern as `custom_order_items`)

Add columns to `custom_orders`:
- `gst_percentage` numeric default 3
- `components_total` numeric default 0
- `components_weight` numeric default 0

### Frontend
- `CustomOrderFormDialog.tsx`: add a "Components" section below product details
  - Rows with: Component Name, Material, Weight, Qty, Unit Price, Total (auto = weight×rate OR qty×unit_price; if both, prefer qty×unit_price when unit_price>0)
  - "+ Add Component" dashed purple button
  - Per-row delete (×)
  - Summary: Total Component Weight + Total Component Cost
- Add GST % input field (default 3)
- Update total calculation: `making_charges + items_total + components_total`, then GST split CGST = SGST = GST/2
- `useCustomOrders.ts`: save/load components alongside items
- `ViewCustomOrderDialog.tsx` + PDF: show components table + GST breakdown

---

## CHANGE 2 — Service Form: Complete Rework

The current "Service Form" page (`OrderNotes.tsx` + `order_notes` table) is repurposed for general orders. Per your spec, the new Service Form is a distinct workflow (drop-off → receipt → completion → GST invoice). I will build it as a new module rather than break the existing Order Notes flow.

### Database
New tables:

**`service_forms`**
- `receipt_number` (auto SVC-000001 via new RPC `generate_service_receipt_number`)
- `client_id`, `client_name`, `client_phone`
- `item_description`, `from_our_shop` bool, `original_invoice_no`
- `material` (gold/silver/brass/other), `weight_grams`
- `condition_on_receipt`, `photo_url`
- `service_types` text[] (multi-select), `other_service_text`
- `service_notes`, `estimated_delivery_date`, `estimated_cost`
- `status` enum: received | in_progress | ready | completed
- `completed_invoice_id` (FK invoices, nullable)
- timestamps, RLS like order_notes

New storage bucket: `service-form-images` (public, for condition photos).

### Frontend — New module
- `src/pages/ServiceForms.tsx` — list view with columns + status badges + actions
- `src/components/service-forms/ServiceFormDialog.tsx` — create/edit form with the 4 sections (client search reusing `ClientSearchBox` + new-client inline-add, jewellery details, service details)
- `src/components/service-forms/ViewServiceFormDialog.tsx`
- `src/components/service-forms/ServiceFormTable.tsx`
- `src/components/service-forms/CompleteServiceDialog.tsx` — converts to GST service invoice (5% GST, CGST/SGST split, payment mode)
- `src/utils/serviceReceiptPdf.ts` — Service Receipt PDF (purple header, SVC-xxx, signature line)
- `src/hooks/useServiceForms.ts`
- Sidebar: add "Service Forms" nav entry (the existing "Service Form" entry stays — it points to Order Notes / general orders)
- Routing in `App.tsx`: add `/service-forms`

### Service Invoice generation (Complete & Bill)
- Uses existing `invoices` table with GST = 5% override
- Items: each selected service becomes an invoice line (description = service name, qty = 1, total = portion of final charge — or single line "Service: Polish, Repair" with total = final charge)
- After invoice creation, `service_forms.status = 'completed'` and `completed_invoice_id` set
- Reuses `InvoicePreviewModal` / existing PDF for the invoice itself

---

## Scope notes
- This is a large change (~15 new files, 2 migrations, ~1500+ LOC). I'll do it in two commits internally but one response.
- I will NOT modify existing Order Notes / invoice / inventory logic beyond adding the new module and sidebar entry.
- Existing memories preserved (multi-store, audit trail, billing logic, etc.).

Approve to proceed and I'll run the migrations + write the code.
