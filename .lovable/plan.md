
# Phase 2 Expansion Plan

This is a large scope. To keep the app stable and shippable, I'll deliver it in **4 sequenced phases**, each independently testable. Nothing existing gets removed or renamed — only additive changes.

---

## Phase A — Multi-Branch Foundation (do first, it unblocks everything else)

**Why first:** CRM, Reports, and Gold all filter by branch, so the branch column must exist before those modules can key off it.

**DB**
- New table `branches` (code, name, address, phone, email, gst_number, manager_id, status, is_default).
- Seed **Main Branch — Nispaditha Ventures LLP** (`BLR-MAIN`) and backfill it as `branch_id` on every existing row.
- Add nullable `branch_id uuid references branches(id)` to: `products`, `invoices`, `repair_items`, `service_forms`, `clients`, `custom_orders`, `buybacks`, `return_exchanges`, `melting_entries`, `expenses`, `order_notes`. Default = Main Branch.
- Add `assigned_branch_id` on `profiles` for Manager/Staff scoping. Owner (admin) sees all.
- RLS: keep current policies; add branch-scoping helper `public.user_can_access_branch(uuid)` used in future filters (non-breaking).

**Frontend**
- New page `/settings/branches` (Admin only): list, create, edit, activate/deactivate.
- Global **Branch Switcher** in the top bar: "All Branches" (admin only) or a specific branch. Stored in a `useBranchContext` + localStorage.
- Wire the switcher as an optional filter on: Dashboard, Inventory, Invoices, Repairs, Services, Custom Orders, Buyback/Exchange, Melting, Expenses, Pending Payments. Default = current user's assigned branch (or Main).
- Do **not** hard-block existing screens if `branch_id` is null — treat null as Main.

---

## Phase B — Gold Support

**DB**
- Extend `rate_history` and `business_settings` with `gold_rate_22k`, `gold_rate_18k`, `gold_rate_24k` (silver rate untouched).
- `products.metal_type` already exists; ensure `'gold'` is a first-class value and add `gold_purity` (`22K`/`18K`/`24K`) column.

**Frontend**
- Dashboard **Rates card**: show Silver + Gold 22K/18K/24K side by side, each editable inline (admin). Log to `rate_history`.
- Inventory form: when Metal = Gold, show Purity selector; weight-based billing picks the matching gold rate.
- `useInvoiceCalculations`: branch on metal_type → pick silver rate OR gold rate (by purity). Flat Price path untouched.

---

## Phase C — Customer CRM

**Frontend only** (data already exists across `clients`, `invoices`, `repair_items`, `service_forms`, `custom_orders`, `buybacks`, `return_exchanges`, `wallet_transactions`).

- Extend `clients` with `email`, `birthday`, `anniversary`, `preferred_metal`, `preferred_category_id`, `notes` (nullable, non-breaking).
- New route `/customers/:id` — **Customer Profile** with:
  - **Info card** (all fields, inline edit).
  - **Financial Summary** cards: Total Purchases, Custom Orders, Repairs, Services, Buybacks, Exchanges, Wallet, Pending, Lifetime Revenue — computed via parallel Supabase queries + a small `useCustomerSummary` hook.
  - **Timeline**: merged, date-sorted feed of invoices / repairs / custom orders / exchanges / buybacks / services. Each row links to its module.
  - **Statistics** panel: totals, favourite category, last purchase, last visit, avg bill, top vendor, top product (computed client-side from the same queries).
  - **Quick Actions** bar: New Invoice / Repair / Service / Custom Order / Exchange / Buyback (prefill customer), plus `tel:` and `wa.me` links.
- Existing Customers list becomes clickable → profile.

---

## Phase D — Reports Center

**Frontend + a couple of read-only RPCs for heavy aggregations.**

- New route `/settings/reports/center` (keeps existing Reports page intact; this is an upgraded hub).
- Global filter bar: Today / Yesterday / This Week / This Month / Custom, plus Branch / Employee / Vendor / Category.
- Report sections (each a tabbed sub-page, lazy-loaded):
  1. **Sales** — Daily/Weekly/Monthly/Yearly, GST, Payment Mode, by Customer/Category/Vendor/Branch, plus **Silver vs Gold** split.
  2. **Inventory** — Current, Low, Dead, Fast/Slow moving, Valuation, Ageing, Silver/Gold split.
  3. **Repairs** — Pending, Completed, Revenue, Status mix, TAT.
  4. **Custom Orders** — Pending, Completed, Revenue, Delivery.
  5. **Buyback** — Weight, Amount, Metal recovery.
  6. **Exchange** — Value, Profit.
  7. **Melting** — Gross, Recovered, Loss, Inventory added, Vendor-wise.
  8. **Financial** — P&L, Expenses, Cash Flow, Income, Outstanding (Customer + Vendor).
  9. **GST** — CGST, SGST, Tax summary, Monthly GST.
- Every report supports **Export → Excel (xlsx)** and **Export → PDF** via existing pdf/xlsx utilities.

---

## Guardrails (apply to every phase)

- Additive DB only — no drops, no renames, no policy removals.
- Every new `public` table ships with `GRANT` + RLS + policies in the same migration.
- Existing invoice numbering, SKU logic, stock triggers, pricing formulas: **untouched**.
- Match current luxury-fintech UI (gold/slate tokens, shadcn components).
- Each phase is behind its own migration + PR-sized set of files so we can validate before moving on.

---

## Technical notes

- Branch context: `src/contexts/BranchContext.tsx` + `useBranch()` hook; provider mounted in `App.tsx` above the router.
- CRM summary: single `useCustomerSummary(clientId)` fires ~7 parallel `supabase.from(...).select('sum/count')` queries with `Promise.all`.
- Reports aggregations that are expensive (P&L, Ageing, Fast/Slow moving) get SQL views or `security definer` functions to avoid pulling raw rows to the client.
- Gold rate: reuse existing `rate_history` trigger pattern; add columns, don't fork the table.

---

## Suggested execution order

1. **Approve this plan.**
2. I ship **Phase A** (branches + switcher + backfill) and we sanity-check existing screens still work.
3. **Phase B** (Gold) — small, isolated.
4. **Phase C** (CRM profile).
5. **Phase D** (Reports Center) — largest, done last so it can filter by branch + metal from day one.

Reply **"go"** to start Phase A, or tell me to reorder / drop anything.
