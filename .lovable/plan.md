# Multi-Branch Completion + Phase B — Execution Plan

This scope is very large. To keep the app stable, I'll ship it in **6 sequenced milestones**. Each is independently testable, additive-only, and behind its own migration. Nothing existing is removed, renamed, or reformatted.

Reply **"go M1"** (or any milestone number) to start. You can also tell me to reorder / drop items.

---

## M1 — Finish Multi-Branch (make the switcher real)

Right now `branch_id` exists on every table and the switcher is wired, but modules don't actually filter by it yet. This milestone makes branch selection *mean* something.

**DB (one migration)**
- Add `role` enum values: `super_admin`, `branch_manager`, `sales_staff`, `technician`, `inventory_manager`, `cashier` (keep existing `admin`/`staff`).
- Auto-migrate every current `admin` → also `super_admin` (non-destructive; both roles held).
- Add `branches.status` check for `active | inactive | archived` (currently just active flag).
- Add scaffolding tables for future transfers (no UI): `branch_transfers` (kind, from_branch, to_branch, entity_type, entity_id, status, notes).
- Helper fn `public.current_branch_ids()` returning branches the user can see.

**Frontend**
- Wire `useBranch()` into every list query: Dashboard, Inventory, Invoices, Customers, Pending Payments, Repairs, Services, Custom Orders, Returns, Sold, Buyback, Exchange, Melting, Expenses, Activity Log, Reports, SKU Generator. Null `branch_id` rows fall back to Main so nothing disappears.
- Default new records (invoice, product, repair, etc.) to `currentBranchId ?? mainBranch.id`.
- Inactive branch → block "New/Create" buttons with tooltip. Archived → read-only across the app.
- Branches page: Super Admin only Delete Branch (with typed confirmation + count summary of what will be removed). Main Branch never deletable. Status selector (Active/Inactive/Archived).
- "All Branches" already exists for admin — extend it to combine dashboard KPIs.

---

## M2 — Roles & Permissions v2

**DB**
- New table `role_permissions` (role, module, can_view, can_create, can_edit, can_delete, can_print, can_export, can_approve). Seeded defaults per role.
- Helper `public.user_can(module text, action text)`.

**Frontend**
- Settings → **Roles & Permissions** matrix (Super Admin only). Toggle per role/module/action.
- Replace hard-coded `useIsAdmin` gates with `useCan(module, action)`. Existing admin behavior preserved (super_admin = all true).

---

## M3 — Vendor Management + Purchase Orders

**DB**
- Extend `suppliers` (already exists) with: `email`, `pan`, `bank_details jsonb`, `upi_id`, `notes`, `status`, `rating`, `documents jsonb`.
- New tables: `purchase_orders`, `purchase_order_items`, `po_receipts`, `po_receipt_items`.
- View `vendor_ledger` combining PO totals + `vendor_payments`.

**Frontend**
- Upgrade Vendors page → Vendor profile (info, ledger, POs, products supplied, outstanding, performance).
- New `/purchase-orders` module: Draft → Approved → Received (partial/full) → QC → Inventory → Paid. PDF export via existing `invoicePdf` pattern. Print/email.

---

## M4 — Staff, Attendance, Payroll

**DB**
- `employees` (linked optionally to `profiles.user_id`), `employee_documents`.
- `attendance` (clock_in/out, break, status, notes) — one row/day/employee.
- `payroll_runs`, `payroll_lines` (salary, bonus, commission, advance, deductions, PF, ESI, net).

**Frontend**
- `/staff` list + profile (photo, role, branch, salary, targets, performance from invoices/repairs).
- `/attendance` daily grid + export.
- `/payroll` monthly run + payslip PDF.

---

## M5 — Daily Cash Closing + Notification Center + Settings Expansion

**DB**
- `daily_cash_closings` (branch_id, closing_date UNIQUE per branch, opening/sales-by-mode/expenses/withdrawn/deposited/expected/actual/difference, remarks, manager_id, approved_by, approved_at).
- `notifications` (user_id, type, title, body, link, read_at) + generator triggers (low stock, pending repairs, PO due, closing pending, vendor due).

**Frontend**
- `/cash-closing` per branch, one entry/day, auto-computed expected cash from invoices/expenses.
- Bell icon in header with unread badge, dropdown, deep links.
- Settings page grows into tabs: General / GST / Invoice Templates / SMS-WhatsApp-Email / Backup / Security / Users / Roles / Branches / Theme / Number Series / Tax / Printing / Barcode / Import / Export. (Existing sub-pages are just re-grouped, no logic change.)

---

## M6 — Performance Pass (no functional change)

**DB (indexes only — safe, additive)**
- `products (sku)`, `products (branch_id, status)`, `invoices (invoice_number)`, `invoices (branch_id, invoice_date DESC)`, `clients (phone)`, `clients (name gin_trgm_ops)`, `repair_items (branch_id, status)`, `custom_orders (branch_id, status)`, `melting_entries (branch_id, created_at DESC)`, `expenses (branch_id, expense_date)`, `stock_history (product_id, created_at DESC)`, `activity_logs (created_at DESC)`, `sku_registry (sku)`.
- Materialized-view style RPCs for Dashboard KPIs (`dashboard_summary(branch_id, from, to)`) to replace the 6 parallel client queries.

**Frontend**
- React Query cache with sensible `staleTime` for Dashboard / rates / branches / categories / vendors.
- Route-level `React.lazy` for Reports, Payroll, Attendance, PO, Melting, SKU Generator.
- Virtualized rows (`@tanstack/react-virtual`) on Inventory + Invoices + Activity Log when >200 rows.
- Memoize row components + column defs. Debounce every search input (250ms).
- Drop redundant `select('*')` — hand-pick columns on list pages.

---

## Guardrails (every milestone)

- Additive DB only — no drops/renames/policy removals.
- Every new `public` table ships with `GRANT` + RLS + policies in the same migration.
- Existing invoice numbering, SKU logic, stock triggers, pricing formulas, PDFs: **untouched**.
- Luxury fintech tokens (gold/slate) reused via existing shadcn variants.
- Each milestone = 1 migration + a focused set of files, so you can validate before moving on.

---

## Suggested order

M1 → M2 → M3 → M4 → M5 → M6.
M6 last on purpose: indexes and lazy-loading benefit most once all new modules exist.

Reply **"go M1"** to start, or tell me to reorder / cut scope.