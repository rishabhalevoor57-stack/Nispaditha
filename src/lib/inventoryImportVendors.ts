export interface ImportSupplier {
  id: string;
  name: string;
}

export type VendorResolution =
  | { status: 'blank'; supplierId: string | null }
  | { status: 'matched'; supplierId: string }
  | { status: 'unknown'; vendorName: string }
  | { status: 'ambiguous'; vendorName: string };

export const normalizeVendorName = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeImportHeader = (value: string): string =>
  value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s-]+/g, ' ');

export const findVendorColumnIndex = (headers: readonly string[]): number => {
  const normalizedHeaders = headers.map(normalizeImportHeader);
  const aliases = ['vendor name', 'supplier name', 'vendor', 'supplier'];

  for (const alias of aliases) {
    const exactMatch = normalizedHeaders.indexOf(alias);
    if (exactMatch !== -1) return exactMatch;
  }

  for (const alias of ['vendor name', 'supplier name']) {
    const extendedMatch = normalizedHeaders.findIndex(
      (header) => header.startsWith(`${alias} `) || header.startsWith(`${alias} (`),
    );
    if (extendedMatch !== -1) return extendedMatch;
  }

  return -1;
};

export const hasVendorLikeHeader = (headers: readonly string[]): boolean =>
  headers.some((header) => /^(vendor|supplier)(\s|$)/.test(normalizeImportHeader(header)));

export const buildSupplierNameIndex = (
  suppliers: readonly ImportSupplier[],
): Map<string, string | null> => {
  const index = new Map<string, string | null>();

  suppliers.forEach(({ id, name }) => {
    const normalizedName = normalizeVendorName(name);
    if (!normalizedName) return;

    if (index.has(normalizedName) && index.get(normalizedName) !== id) {
      index.set(normalizedName, null);
      return;
    }

    index.set(normalizedName, id);
  });

  return index;
};

export const resolveVendorName = (
  vendorName: string,
  supplierIndex: ReadonlyMap<string, string | null>,
  currentSupplierId: string | null = null,
): VendorResolution => {
  const normalizedName = normalizeVendorName(vendorName);
  if (!normalizedName) return { status: 'blank', supplierId: currentSupplierId };
  if (!supplierIndex.has(normalizedName)) return { status: 'unknown', vendorName: vendorName.trim() };

  const supplierId = supplierIndex.get(normalizedName);
  if (!supplierId) return { status: 'ambiguous', vendorName: vendorName.trim() };

  return { status: 'matched', supplierId };
};