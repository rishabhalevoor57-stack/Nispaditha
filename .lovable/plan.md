## Overview

This is a large multi-section build covering returns/exchanges/buyback, a store wallet/credits system, a new repair workflow, invoice cancellation, several invoice bug fixes, and a sidebar rename. I'll group the work into logical phases so nothing breaks existing functionality.

---

## Phase 1 — Database additions (one migration, additive only)

New tables:
- `store_wallets` — `client_id` (unique), `balance numeric default 0`, `updated_at`
- `wallet_transactions` — `client_id`, `type` ('credit'|'debit'), `amount`, `source` ('return'|'exchange'|'buyback'|'manual'|'invoice'|'invoice_refund'), `reference_id`, `notes`, `created_by`, `created_at`
- `repair_items` — `product_id` (nullable), `sku`, `product_name`, `weight_grams`, `quantity`, `original_invoice_id`, `original_invoice_number`, `client_name`, `client_phone`, `source` ('return'|'exchange'|'buyback'), `source_reference_id`, `status` ('in_repair'|'sent_to_inventory'), `date_sent`, `date_resolved`, `notes`

New columns (additive):
- `invoices`: `store_credits_used numeric default 0`, `cancellation_reason text`, `cancelled_at timestamptz`, `cancelled_by uuid`
- `return_exchanges`: `subtype text` (allow 'buyback'), `refund_method text` ('store_credit'|'cash'), `disposition text` ('repair'|'inventory'), `live_rate_used numeric`, `round_off numeric default 0`, `total_weight numeric`

RLS: authenticated read/insert/update; admin-only delete. Mirrors existing patterns.

Helper function `add_wallet_credit(client_id, amount, source, ref_id, notes)` and `use_wallet_credit(...)` to keep balance consistent.

Trigger: when invoice is deleted (not cancelled), free invoice number is automatic since generator already takes MAX+1. For cancel, mark `cancelled_at`/`cancellation_reason`, leave row + number in place (already retired by virtue of existing).

Stock restore on cancel handled in app code (matches existing delete flow).

---

## Phase 2 — Sidebar rename (Section 2)

Rename "Order Notes" → "Service Form" in `Sidebar.tsx` and the Order Notes page header. Route `/order-notes` stays (no functional change).

---

## Phase 3 — Store Wallet core (Sections 4, 5, 11)

- `useStoreWallet(clientId)` hook: returns balance + transactions, exposes `addCredit`, `useCredit`, `setBalance`.
- `StoreWalletCard` component shown in `ClientProfileDialog` next to Outstanding Payments. Includes admin-only "Adjust" button.
- Wallet transaction history table inside the same dialog.
- Invoice form: when a client is selected, show a small "Store Wallet: ₹X,XXX available" badge.
- Invoice totals section: "Use Store Wallet Credits" input (capped at min(balance, grand_total)). Recompute "Amount After Credits". Add "Store Wallet" to payment-mode dropdown — selecting it auto-fills max applicable credit.
- On invoice create/finalize: write `store_credits_used` to invoice row + insert wallet_transaction (debit) + decrement wallet balance. If amount_after_credits == 0 → mark paid_at & status paid.

---

## Phase 4 — Returns/Exchange/Buyback (Sections 1, 12)

- `ReturnsExchanges` page tabs become: All | Returns | Exchanges | Buyback.
- Existing Return/Exchange flow:
  - No GST line on the refund (UI hides GST).
  - Default refund = grand_total of original invoice for full-invoice return; per-item math kept for partial.
  - Refund method toggle: "Store Credits" (default) vs "Cash" — Cash only allowed for Returns.
  - Time-limit warnings (Return 6–10 days, Exchange 4–8 days) — soft warning, not hard block.
- New Buyback flow (new dialog `BuybackDialog`):
  - Step 1: enter original invoice number → verify client ownership.
  - Step 2: pick item(s), enter weight (defaults to product weight × qty). Show today's silver rate (live).
  - Refund = silver_rate × weight + Round Off.
  - Refund method = Store Credits only.
  - Saved as `return_exchanges` with `type='return'`, `subtype='buyback'`, refund_method, live_rate_used, round_off, total_weight.
- After processing (all 3 types): "Disposition" toggle — "Send to Repair" (creates `repair_items` row, no stock increase) vs "Send to Inventory" (existing stock-restore path). Stored in `disposition`.
- Credits applied automatically when refund_method='store_credit' (insert wallet_transaction credit + bump balance).

---

## Phase 5 — Repair page (Section 3)

- New route `/repair`, sidebar entry "Repair" (Wrench icon) above "Activity Log".
- List view (similar to Sold): Date Sent | Product | SKU | Weight | Original Invoice | Client | Status toggle | Actions.
- Toggle "In Repair" → "Send to Inventory": increments product quantity by `quantity` (or 1), inserts stock_history row, marks repair row `sent_to_inventory` + `date_resolved`.
- Admin-only delete.

---

## Phase 6 — Invoice cancellation (Section 6)

- Add `Cancel` button beside Delete in invoice list/view (admin only, only when not already cancelled).
- Confirm dialog with reason textarea.
- On confirm: set `status='cancelled'`, `cancelled_at`, `cancellation_reason`; restore stock for each invoice item (mirror delete logic but keep rows); reverse wallet usage (credit back any `store_credits_used`); reverse advance payments? — keep payments rows but mark invoice cancelled (refunds out of scope).
- UI: red "CANCELLED" badge in list; PDF gets large diagonal red watermark; cannot edit; payment actions disabled.
- Invoice number is naturally retired because the row remains (generator does MAX+1).

---

## Phase 7 — Invoice bug fixes & polish (Sections 7, 8, 9, 10)

- **Section 7** (edit-save bug): in `ViewInvoiceDialog` / edit handler, ensure update payload includes client_name, phone, payment_mode, invoice_date and the form re-fetches after save. Fix any stale-state revert. Confirm Save button visible (z-index/sticky footer).
- **Section 8** (live rate): in `CreateInvoiceDialog`, fetch silver/gold rate on mount via existing rate hook; show fallback "(last known rate)" if fetch fails; show "Rate unavailable — enter manually" if no value at all; ensure metal toggle updates immediately.
- **Section 9** (PDF header logo overlap): in `invoicePdf.ts`, give center logo a fixed width column, hide image entirely when missing (no white box).
- **Section 10** (PAID badge): reduce to 13px / 6px 16px padding, single-line, beside Grand Total.

---

## Phase 8 — Client dashboard PDF (Section 5)

- "Download Client Report" button in `ClientProfileDialog`.
- New util `clientReportPdf.ts` using existing jsPDF setup: purple header (Nispaditha), client info, wallet balance, purchase history, returns/exchanges/buyback history, wallet transactions, lifetime spend, purple footer.

---

## Technical notes

- Reuse existing patterns: `is_admin()` for admin-only RLS, soft-update via `useActivityLogger`, `parseDateSafe`, optimistic UI in lists.
- All new tables get `created_at`/`updated_at` with the standard trigger.
- No existing tables/columns are removed.
- Client wallet logic centralized in one hook + one set of RPCs to avoid drift.
- Invoice save bug fix is targeted; no broader refactor of invoice form.
- Sidebar route for Service Form keeps `/order-notes` so deep links keep working.

---

## Risks / things I'll verify after build

1. Wallet balance never goes negative (DB check + UI cap).
2. Cancelled invoice doesn't double-restore stock if also deleted later (guard: skip stock restore on delete when already cancelled).
3. Buyback against invoices with no `weight_grams` (e.g. flat-price items) — allow manual weight entry.
4. Repair → inventory increments correct product (match by `product_id`; if null, match by SKU).
5. Existing Returns/Exchange records (no `subtype`/`refund_method`) keep working — defaults handle this.

---

## Out of scope unless requested

- Refunding cash payments back when an invoice is cancelled (we mark cancelled + restore stock + credit-back wallet portion only).
- Wallet expiry / per-store wallets.
- Buyback for non-silver items (request specifies silver only).
