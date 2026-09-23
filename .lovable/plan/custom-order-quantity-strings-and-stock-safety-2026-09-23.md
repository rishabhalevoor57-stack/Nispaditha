# Custom Order Quantity, Strings, and Stock Safety

## What will change
- Preserve the exact saved Qty and Strings values across create, edit, view, Custom Order bill, GST conversion, invoice preview, print, and PDF—including zero.
- Remove fallback expressions that silently replace saved zero values with `1` or derive one field from another.
- Keep Custom Order viewing fully read-only; loading, previewing, printing, and reopening will perform no writes.
- Keep all automatic stock movements quantity-only. Stored product weight remains unchanged.
- Ensure confirmed-order edits reconcile old and new quantities exactly once, while cancel/delete restores only previously deducted quantity.
- Prevent duplicate deduction and restoration by keeping stock changes guarded and transactional.

## Technical details
- Carry separate quantity and strings fields through the existing Custom Order and invoice detail types and saved payloads.
- Preserve component `unit`, `quantity`, `quantity_used`, and `strings_used` during create/update instead of dropping them.
- Add one backend transaction for Custom Order updates so an already-deducted order restores the old saved items, replaces data, then deducts the new saved items atomically.
- Retain the existing quantity-only stock movement function and its idempotency lock/flag.
- Remove the obsolete in-house inventory function that can bypass current stock rules, while keeping the active workflow unchanged.

## Validation
- Create Qty 4 / Strings 7, then verify view and bill values.
- Edit to Qty 9 / Strings 0, then verify save, view, bill, and GST transfer.
- Confirm quantity decreases once while weight remains unchanged.
- Open/view repeatedly and verify no order, payment, invoice, or stock movement is created.
- Cancel/delete and verify quantity restores once; normal edits and printing do not restore stock.
