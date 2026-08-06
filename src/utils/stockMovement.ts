import { supabase } from '@/integrations/supabase/client';

export interface StockMoveInput {
  productId: string;
  /** Positive = stock in, negative = stock out */
  qtyDelta: number;
  /** Optional weight delta in grams (positive = in, negative = out) */
  weightDelta?: number;
  /** Originating module, e.g. inventory | invoice | repair | returns | sold */
  module: string;
  /** Human readable action, e.g. "Repair Return", "Bulk Import" */
  action: string;
  referenceId?: string | null;
  referenceLabel?: string | null;
  reason?: string | null;
}

/**
 * Single entry point for every client-side stock movement.
 * Applies the delta and writes a full audit row (before/after qty + weight,
 * module, action, reference) through the `log_stock_move` database function.
 */
export async function logStockMove(input: StockMoveInput): Promise<void> {
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>)('log_stock_move', {
    p_product_id: input.productId,
    p_qty_delta: Math.round(input.qtyDelta),
    p_weight_delta: input.weightDelta ?? 0,
    p_module: input.module,
    p_action: input.action,
    p_reference_id: input.referenceId ?? null,
    p_reference_label: input.referenceLabel ?? null,
    p_reason: input.reason ?? input.action,
  });
  if (error) throw new Error(error.message);
}
