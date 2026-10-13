# Reporting architecture
- Dashboard inventory summaries, category valuation, and inventory reports use `useInventorySnapshot` and `inventoryMetrics` for branch-scoped authoritative product data; shared reads prevent divergent definitions without changing transaction writes.
- Stock reporting refreshes on product changes, inventory refresh events, page entry, and periodic reads; fallback polling covers environments where database realtime is not enabled.
- SKU registry history without branch ownership is included only in consolidated reporting; branch reports use preserved product history to avoid attributing global SKUs to a branch.

# Inventory import architecture
- Reuse products.metal_type and supplier_id for inventory Metal and vendor relationships; parallel fields would diverge from existing transaction consumers.
- Inventory CSV/Excel parsing and vendor/metal validation live in inventoryImport; validate all relationships before writes and resolve fresh vendor records to avoid stale lookup failures.
- Unknown vendors require creation through the existing Vendors screen; imports must never silently discard names or create incomplete duplicate master records.