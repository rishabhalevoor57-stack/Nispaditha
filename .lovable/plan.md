# Implementation Plan — Returns/Exchange/Buyback + Invoice Wallet + PDF Fixes

This is a large multi-part request. I'll execute it in clearly scoped batches so nothing currently working breaks. Below is exactly what I'll change and in what order.

## Batch A — Returns / Exchange / Buyback flow

**Exchange (CHANGE 1)**
- Remove "New Items" search/selection from `ExchangeDetailsStep.tsx`.
- Make Exchange behave like Return: refund = grand total of returned items as Store Credits (default), with a "Refund as Cash" toggle.
- Zero GST.
- Add "After Exchange — Send Item To" radio: **Inventory** (default, stock +1) or **Repair** (insert into `repair_items`, stock unchanged).
- Credits auto-credited to client wallet via `adjustWallet`.

**Return (CHANGE 2)**
- Add the same "Send Item To" Inventory/Repair radio in `ReturnDetailsStep.tsx`.
- Keep existing store-credit/cash refund logic.

**Buyback (CHANGE 3 + follow-up CHANGE 1)**
- In `BuybackDialog.tsx` add a top selector: **Jewellery Buyback** | **Metal Buyback**.
- Jewellery: existing flow + editable rate + Round Off field.
- Metal: no invoice; fields = Metal Type (Silver/Gold/Brass/Other w/ text), Weight, Rate (auto from `business_settings`, editable), Round Off, live calculated amount, "Store Credits to be added" preview.
- **Remove** the Inventory/Repair toggle from Buyback entirely — all buyback items go straight to `repair_items` automatically (jewellery goes with product link; metal goes as raw entry with metal type in notes).
- Refund method = Store Credits only. No GST.

**Invoice list dropdown (CHANGE 4)**
- In invoices row actions, add "Buyback" option alongside Return/Exchange. Clicking opens `BuybackDialog` in Jewellery mode with invoice pre-filled.

**Returns page tabs (CHANGE 5)**
- Tabs already include Buyback. Verify counts and that buyback rows display correctly. Add metal-specific columns when type = buyback (Metal/Weight/Rate/Round Off/Credits/Invoice Ref).

**Wallet auto-sync (CHANGE 6)**
- Already done via `adjustWallet`; add toast `₹X credits added to <Client>'s wallet` on confirmation. The `useStoreWallet` hook re-fetches when client dialog opens.

## Batch B — Invoice Store Wallet integration

**CHANGE 2 + 3 (Invoice form wallet)**
- In `CreateInvoiceDialog.tsx`:
  - When existing client selected, fetch wallet balance and show `Store Wallet: ₹X available` chip near client name.
  - In totals area (before Grand Total), show Store Wallet section with "Use Credits" input, capped at min(balance, grandTotal). Hide entirely if balance = 0.
  - Show "Amount to Pay" = grandTotal − creditsUsed.
  - If 0 → auto-mark PAID, payment_mode = `store_wallet`, hide payment fields.
  - If > 0 → existing payment options (Paid / Advance / Pending) on remaining amount.
  - On save: write `store_credits_used`, debit wallet via RPC.

(Most of this was implemented in prior turn. I'll verify and add the visible "available" chip + green "Paid in Full" badge when credits cover full total.)

## Batch C — Bug fixes

**BUG FIX 4 — Live rate not showing**
- In `CreateInvoiceDialog` / `MetalRateToggle`, ensure rate loads on mount via the same source used by `LiveMetalRatesCard` (`business_settings.silver_rate_per_gram` / `gold_rate_per_gram`). Show `(from software)` label, fall back to last known with `(last known)`. Allow manual override; auto-fill product Rate/g.

**BUG FIX 5 — Terms text overlap in PDF**
- In `invoicePdf.ts`, fix Terms rendering: use jsPDF `splitTextToSize` with proper width and increase line spacing. Currently text is being painted at fixed Y without wrapping — switch to wrapped paragraph mode with line height ~1.6.

**BUG FIX 6 — Empty space below payment summary**
- Remove forced full-page height; let signature/footer follow content. Compute `currentY` after Terms and place signature/footer at `currentY + 16`, not at fixed bottom.

**BUG FIX 7 — Logo placeholder white box**
- In header drawing, only draw logo block if `business_settings.logo_url` exists and image loads. On error, skip entirely (no white rect). Don't reserve the box if no logo.

## Batch D — Database

Add columns (idempotent migration) on `invoices`:
- `amount_after_credits NUMERIC DEFAULT 0`
- `amount_paid_via_mode NUMERIC DEFAULT 0`
- `payment_mode_for_remaining TEXT`

(`store_credits_used` already exists.)

For Metal Buyback storage: reuse `return_exchanges` with `type='buyback'`, `subtype='metal'|'jewellery'`, store metal type in `notes`/new field. Add `metal_type TEXT NULL` and `buyback_kind TEXT NULL` to `return_exchanges` so the Buyback tab can render metal columns cleanly.

## Order of execution

1. Run migration (Batch D).
2. Implement Batch A (Returns/Exchange/Buyback UI + logic).
3. Implement Batch B (invoice wallet visibility polish).
4. Implement Batch C (PDF + live rate fixes).
5. Verify by opening Invoice form and Returns page in preview; download a sample PDF.

## Won't touch

Invoice layout/branding, GST split, Round Off, Terms content, calculations, SKU search, Pending Payments, Custom Orders, Repair existing flow, existing Supabase columns.
