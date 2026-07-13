// Unified metal engine — Phase A
// Silver stays the default across the ERP; gold 18K & 24K are derived from stored 22K rate.

export type MetalType = 'silver' | 'gold_18k' | 'gold_22k' | 'gold_24k';

export const METAL_TYPE_OPTIONS: { value: MetalType; label: string; short: string }[] = [
  { value: 'silver',   label: 'Silver',   short: 'Ag'   },
  { value: 'gold_18k', label: 'Gold 18K', short: '18K'  },
  { value: 'gold_22k', label: 'Gold 22K', short: '22K'  },
  { value: 'gold_24k', label: 'Gold 24K', short: '24K'  },
];

export const DEFAULT_METAL_TYPE: MetalType = 'silver';

export const METAL_TYPE_LABEL: Record<string, string> = {
  silver: 'Silver',
  gold_18k: 'Gold 18K',
  gold_22k: 'Gold 22K',
  gold_24k: 'Gold 24K',
};

export function normalizeMetalType(value: string | null | undefined): MetalType {
  if (!value) return DEFAULT_METAL_TYPE;
  const v = value.toLowerCase().trim();
  if (v.includes('18')) return 'gold_18k';
  if (v.includes('24')) return 'gold_24k';
  if (v.includes('22') || v === 'gold') return 'gold_22k';
  return 'silver';
}

/**
 * Resolve per-gram rate for a given metal type from the base rates stored in
 * business_settings (silver + gold 22k). 18K and 24K are derived from 22K.
 */
export function resolveMetalRate(
  metal: MetalType,
  base: { silver: number; gold22: number },
): number {
  switch (metal) {
    case 'silver':   return base.silver || 0;
    case 'gold_22k': return base.gold22 || 0;
    case 'gold_18k': return (base.gold22 || 0) * (18 / 22);
    case 'gold_24k': return (base.gold22 || 0) * (24 / 22);
  }
}

export function formatMetalLabel(metal: string | null | undefined): string {
  const m = normalizeMetalType(metal);
  return METAL_TYPE_LABEL[m] || 'Silver';
}
