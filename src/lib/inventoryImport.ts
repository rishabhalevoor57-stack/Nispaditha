import type { ProductFormData } from '@/types/inventory';
import { normalizeMetalType, type MetalType } from '@/lib/metalTypes';

export type InventoryImportRow = Partial<ProductFormData> & { _category_name?: string; _vendor_name?: string };

export const normalizeVendorName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function resolveImportVendor(name: string | undefined, vendors: { id: string; name: string }[]): string | undefined {
  if (!name?.trim()) return undefined;
  const matches = vendors.filter(v => normalizeVendorName(v.name) === normalizeVendorName(name));
  if (matches.length !== 1) throw new Error(matches.length ? `Vendor "${name}" matches multiple records. Please resolve duplicate vendor names first.` : `Vendor "${name}" was not found. Add it in Vendors first, then import again.`);
  return matches[0].id;
}

export function parseInventoryMetal(value: string | undefined, purity?: string): MetalType | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  if (normalized === 'silver') return 'silver';
  if (/^gold(?: (?:18|22|24)\s*k)?$/.test(normalized)) return normalizeMetalType(normalized === 'gold' ? `gold ${purity || '22k'}` : normalized);
  throw new Error(`Invalid Metal "${value}". Use Silver, Gold, Gold 18K, Gold 22K or Gold 24K.`);
}

  const normalizeHeader = (header: string): string => {
    return header
      .trim()
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s-]+/g, ' ');
  };

  const detectDelimiter = (text: string): string => {
    const sample = text
      .split('\n')
      .slice(0, 5)
      .join('\n');

    const delimiters = [',', ';', '\t', '|'];
    let best = ',';
    let max = -1;

    delimiters.forEach((delimiter) => {
      const count = sample.split(delimiter).length - 1;
      if (count > max) {
        max = count;
        best = delimiter;
      }
    });

    return best;
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current);
    return result;
  };

  const findColumnIndex = (headers: string[], aliases: readonly string[]): number => {
    const normalizedHeaders = headers.map(normalizeHeader);
    const normalizedAliases = aliases.map(normalizeHeader);

    for (const alias of normalizedAliases) {
      const exact = normalizedHeaders.indexOf(alias);
      if (exact !== -1) return exact;
    }

    for (const alias of normalizedAliases) {
      const startsWith = normalizedHeaders.findIndex((h) => h.startsWith(alias));
      if (startsWith !== -1) return startsWith;
    }

    for (const alias of normalizedAliases) {
      const contains = normalizedHeaders.findIndex((h) => h.includes(alias));
      if (contains !== -1) return contains;
    }

    return -1;
  };

  const parseLocalizedNumber = (value: string): number => {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    let normalized = trimmed.replace(/[₹$€£¥\s]/g, '');
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '');
      normalized = normalized.replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  export const parseInventoryCSV = (text: string): InventoryImportRow[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('File must have at least a header and one data row');

    const delimiter = detectDelimiter(lines.slice(0, 5).join('\n'));
    const headers = parseCSVLine(lines[0], delimiter).map((h) => h.trim());

    const columnMap = {
      sku: ['sku', 'product sku', 'item code', 'code'],
      name: ['product name', 'name', 'item name'],
      description: ['description', 'details'],
      type_of_work: ['type of work', 'type_of_work', 'work type'],
      category: ['category', 'cat'],
      weight_grams: ['weight', 'weight_grams', 'weight grams', 'gross weight'],
      quantity: ['qty', 'quantity', 'stock'],
      pricing_mode: ['mode', 'pricing_mode', 'pricing mode', 'price mode'],
      vendor: ['vendor', 'supplier', 'vendor name'],
      price_per_gram: ['selling price per gram', 'price_per_gram', 'price per gram', 'rate per gram', 'selling piece per gram'],
      making_charges: ['selling mc', 'making_charges', 'making charges', 'making charge', 'mc'],
      purchase_price_per_gram: ['purchase price per gram', 'purchase_price_per_gram'],
      purchase_making_charges: ['purchase mc', 'purchase_making_charges', 'purchase making charges'],
      date_ordered: ['date of purchase', 'date_ordered', 'date ordered', 'purchase date'],
      gst_percentage: ['gst', 'gst_percentage', 'gst percentage'],
      purity: ['purity', 'karat'],
      metal_type: ['metal_type', 'metal type', 'metal'],
      status: ['status', 'stock status'],
      bangle_size: ['bangle_size', 'bangle size', 'size'],
      mrp: ['mrp', 'max retail price'],
      selling_price: ['selling_price', 'selling price', 'sale price', 'list price'],
      purchase_price: ['purchase_price', 'purchase price', 'cost price'],
      low_stock_alert: ['low_stock_alert', 'low stock alert', 'reorder level'],
    } as const;

    const indexes = Object.fromEntries(
      Object.entries(columnMap).map(([key, aliases]) => [key, findColumnIndex(headers, aliases)])
    ) as Record<keyof typeof columnMap, number>;

    if (indexes.sku === -1 || indexes.name === -1) {
      throw new Error('CSV must include SKU and Name columns (any common naming variation is supported).');
    }

    const getValue = (values: string[], index: number): string => {
      if (index < 0) return '';
      return (values[index] || '').trim();
    };

    const products: InventoryImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      const sku = getValue(values, indexes.sku);
      const name = getValue(values, indexes.name);

      if (!sku || !name) continue;

      const rawStatus = getValue(values, indexes.status).toLowerCase().replace(/\s+/g, '_');
      const rawPricingMode = getValue(values, indexes.pricing_mode).toLowerCase().replace(/\s+/g, '_');

      const product: Partial<ProductFormData> & { _category_name?: string; _vendor_name?: string } = {
        sku,
        name,
        description: getValue(values, indexes.description),
        metal_type: parseInventoryMetal(getValue(values, indexes.metal_type), getValue(values, indexes.purity)),
        purity: getValue(values, indexes.purity),
        weight_grams: parseLocalizedNumber(getValue(values, indexes.weight_grams)),
        quantity: Math.round(parseLocalizedNumber(getValue(values, indexes.quantity))),
        price_per_gram: parseLocalizedNumber(getValue(values, indexes.price_per_gram)),
        making_charges: parseLocalizedNumber(getValue(values, indexes.making_charges)),
        mrp: parseLocalizedNumber(getValue(values, indexes.mrp)),
        selling_price: parseLocalizedNumber(getValue(values, indexes.selling_price)),
        purchase_price: parseLocalizedNumber(getValue(values, indexes.purchase_price)),
        type_of_work: getValue(values, indexes.type_of_work) || 'Others',
        status: rawStatus === 'sold' || rawStatus === 'for_repair' ? rawStatus : 'in_stock',
        bangle_size: getValue(values, indexes.bangle_size),
        low_stock_alert: Math.round(parseLocalizedNumber(getValue(values, indexes.low_stock_alert))),
        gst_percentage: parseLocalizedNumber(getValue(values, indexes.gst_percentage)),
        pricing_mode: rawPricingMode === 'flat_price' || rawPricingMode === 'flat' ? 'flat_price' : 'weight_based',
        purchase_price_per_gram: parseLocalizedNumber(getValue(values, indexes.purchase_price_per_gram)),
        purchase_making_charges: parseLocalizedNumber(getValue(values, indexes.purchase_making_charges)),
        date_ordered: getValue(values, indexes.date_ordered) || new Date().toISOString().split('T')[0],
        _category_name: getValue(values, indexes.category),
        _vendor_name: getValue(values, indexes.vendor),
      };

      products.push(product);
    }

    if (products.length === 0) {
      throw new Error('No valid products found. Each row must include SKU and Name.');
    }

    return products;
  };

