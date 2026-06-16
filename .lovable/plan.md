## SKU Generator Module — Implementation Plan

A new top-level module to generate, reserve, manage, print, export, and track SKUs before they are attached to inventory. Acts as the **single source of truth** for SKU creation.

---

### 1. Database (single migration)

**New table: `sku_registry`** — permanent reservation table. Once a row is inserted, it is NEVER deleted (only status changes).

Columns:
- `sku` (text, PRIMARY KEY) — full code e.g. `NABSCP80`
- `type_of_work_code`, `vendor_code`, `category_code`, `running_number`
- `type_of_work_id`, `vendor_id` (FK suppliers), `category_id` (FK categories)
- `status` (enum: `generated | assigned | in_inventory | sold | archived | deleted_product | used | inactive`)
- `product_id` (FK products, nullable) — set when assigned
- `barcode_value` (text) — same as SKU (Code128)
- `qr_payload` (jsonb) — SKU + vendor + category + work + date + status
- `notes`
- `created_by`, `created_at`, `updated_at`

**Add code columns** so codes are stable and editable:
- `categories.code` (text, nullable, unique-when-not-null)
- `suppliers.code` (text, nullable, unique-when-not-null)
- `types_of_work.code` (text, nullable, unique-when-not-null)

**RPC `generate_skus(type_of_work_id, vendor_id, category_id, quantity)`** — security definer, atomic:
1. Resolve/auto-fill codes (Type of Work from fixed map; Vendor from initials; Category from first letter or 2 letters).
2. Compute prefix `[TW][V][C]`.
3. Lock the registry, find `MAX(running_number)` for that prefix.
4. Insert N new rows starting at `MAX+1`, status `generated`.
5. Cross-check against `products.sku`, `manual_sold_items.sku`, `repair_items.sku`, `return_exchange_items.sku`, `custom_order_items.sku` — skip used numbers.
6. Return inserted SKUs.

**Trigger on `products`**: when an inventory item is created/updated/soft-deleted/sold, sync the corresponding `sku_registry.status` and `product_id`. Never delete the registry row.

GRANTs + RLS: authenticated full SELECT/INSERT/UPDATE, only admins can UPDATE status to `inactive`. No DELETE for anyone.

---

### 2. Frontend

**Sidebar**: new entry `SKU Generator` (icon: Barcode), route `/sku-generator`.

**Pages / components** (under `src/pages/SkuGenerator.tsx` + `src/components/sku/`):

1. **Dashboard tab** — 7 stat cards (Total / Assigned / Available / Sold / Archived / Deleted / Recently Generated list).
2. **Generate tab** — form with: Type of Work, Vendor, Category, Quantity (with quick buttons 10/50/100/custom). Shows preview prefix + next number. Submit → calls RPC, shows generated list.
3. **History tab** — searchable/filterable table (SKU, vendor, category, work, date, created by, status, assigned product, barcode preview, QR preview). Filters: status, vendor, category, work, date range, free-text.
4. **Label printing** — select rows → "Print Labels" opens a print-ready sheet (jsPDF) with barcode (JsBarcode) + QR (qrcode) + SKU + vendor + category. Bulk select supported.
5. **Export** — Excel/CSV/PDF of selected or filtered set; dedicated Barcode-only sheet and QR-only sheet.

**Inventory integration** (`ProductFormDialog`):
- New SKU input becomes an **autocomplete dropdown** of `status='generated'` SKUs from `sku_registry`. Admin toggle "Enter manually" preserved.
- On save, validate SKU exists in registry; trigger updates status to `assigned`/`in_inventory`.

---

### 3. Code generation rules (frontend helpers)

- `typeOfWorkCode`: fixed map (NA, CA, HM, MM, AN, PO, CU). New entries → first 2 letters uppercase, fallback to existing `code` column.
- `vendorCode`: stored `code` if present, else initials of words (3 chars), with collision suffix.
- `categoryCode`: fixed map (P, R, C, B, E, N, A, BG, CN), else first letter / 2 letters, with collision suffix.
- Codes persist back into `categories.code` / `suppliers.code` / `types_of_work.code` on first generation so future generations are stable.

---

### 4. Libraries to install

- `jsbarcode` — Code128 barcode rendering
- `qrcode` — QR generation (canvas + dataURL)

(`jspdf` + `jspdf-autotable` + `xlsx` already in project for exports.)

---

### 5. Permanence guarantees

- Registry rows never deleted (no DELETE policy).
- Soft-deleting a product, selling, archiving, invoice deletion → only mutate `status`.
- Cross-check on generation against all other SKU-bearing tables to avoid historical collisions.
- DB unique constraint on `sku_registry.sku` ensures 100k+ scale.

---

### Files to add / edit

**Add**
- `supabase` migration (table + columns + RPC + triggers + RLS + GRANTs)
- `src/pages/SkuGenerator.tsx`
- `src/components/sku/SkuDashboard.tsx`
- `src/components/sku/SkuGenerateForm.tsx`
- `src/components/sku/SkuHistoryTable.tsx`
- `src/components/sku/SkuLabelPrint.tsx`
- `src/components/sku/SkuPicker.tsx` (autocomplete for inventory)
- `src/hooks/useSkuRegistry.ts`
- `src/utils/skuCodes.ts` (code mapping helpers)
- `src/utils/skuLabelPdf.ts`

**Edit**
- `src/components/layout/Sidebar.tsx` — add nav entry
- `src/App.tsx` — add route
- `src/components/inventory/ProductFormDialog.tsx` — integrate `SkuPicker`
- `package.json` — add `jsbarcode`, `qrcode`

---

### Confirm before I build

1. **Auto-codes for new vendors/categories**: I'll auto-derive (initials / first letters) and let admin edit the code later in Settings. OK?
2. **Manual SKU entry in Inventory**: keep as an **admin-only** override (per rule 20). OK?
3. **Existing inventory items**: I'll **backfill** `sku_registry` from current `products.sku` on migration so nothing collides. OK?
4. **Label size**: default to **50mm x 25mm** jewellery tag layout (SKU + barcode + QR + vendor/category). OK or different size?