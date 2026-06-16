// Code derivation helpers for the SKU Generator module.

export const TYPE_OF_WORK_CODE_MAP: Record<string, string> = {
  nakash: 'NA',
  casting: 'CA',
  handmade: 'HM',
  'machine made': 'MM',
  machinemade: 'MM',
  antique: 'AN',
  polish: 'PO',
  custom: 'CU',
};

export const CATEGORY_CODE_MAP: Record<string, string> = {
  pendant: 'P',
  ring: 'R',
  chain: 'C',
  bracelet: 'B',
  earring: 'E',
  earrings: 'E',
  necklace: 'N',
  anklet: 'A',
  bangle: 'BG',
  bangles: 'BG',
  coin: 'CN',
};

const clean = (s: string) => (s || '').trim().replace(/[^a-zA-Z0-9 ]/g, '');

export function deriveTypeOfWorkCode(name: string, existing?: string | null): string {
  if (existing && existing.trim()) return existing.trim().toUpperCase();
  const key = clean(name).toLowerCase();
  if (TYPE_OF_WORK_CODE_MAP[key]) return TYPE_OF_WORK_CODE_MAP[key];
  const letters = clean(name).replace(/\s+/g, '');
  return (letters.slice(0, 2) || 'XX').toUpperCase();
}

export function deriveVendorCode(name: string, existing?: string | null): string {
  if (existing && existing.trim()) return existing.trim().toUpperCase();
  const words = clean(name).split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  }
  return (clean(name).slice(0, 3) || 'XXX').toUpperCase();
}

export function deriveCategoryCode(name: string, existing?: string | null): string {
  if (existing && existing.trim()) return existing.trim().toUpperCase();
  const key = clean(name).toLowerCase();
  if (CATEGORY_CODE_MAP[key]) return CATEGORY_CODE_MAP[key];
  const letters = clean(name).replace(/\s+/g, '');
  return (letters.slice(0, Math.min(2, letters.length)) || 'X').toUpperCase();
}

export const STATUS_LABELS: Record<string, string> = {
  generated: 'Generated',
  assigned: 'Assigned',
  in_inventory: 'In Inventory',
  sold: 'Sold',
  archived: 'Archived',
  deleted_product: 'Deleted Product',
  used: 'Used',
  inactive: 'Inactive',
};

export const STATUS_COLORS: Record<string, string> = {
  generated: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-amber-100 text-amber-800 border-amber-200',
  in_inventory: 'bg-green-100 text-green-800 border-green-200',
  sold: 'bg-purple-100 text-purple-800 border-purple-200',
  archived: 'bg-slate-100 text-slate-800 border-slate-200',
  deleted_product: 'bg-red-100 text-red-800 border-red-200',
  used: 'bg-orange-100 text-orange-800 border-orange-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
};
