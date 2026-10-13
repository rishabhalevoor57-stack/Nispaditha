import { describe, expect, it } from 'vitest';
import { parseInventoryCSV, parseInventoryMetal, resolveImportVendor } from '@/lib/inventoryImport';
import { resolveMetalRate } from '@/lib/metalTypes';

const vendors = [{ id: 'vendor-a', name: 'Vendor A' }];

describe('inventory vendor imports', () => {
  it('links an existing vendor with case and space differences', () => {
    expect(resolveImportVendor('  VENDOR   a  ', vendors)).toBe('vendor-a');
  });
  it('reuses the same vendor for multiple products', () => {
    expect(['Vendor A', 'vendor a'].map(v => resolveImportVendor(v, vendors))).toEqual(['vendor-a', 'vendor-a']);
  });
  it('rejects new or unmatched vendors with a useful validation message', () => {
    expect(() => resolveImportVendor('New Vendor', vendors)).toThrow('Add it in Vendors first');
  });
  it('leaves an empty vendor unspecified so a merge retains its existing vendor', () => {
    expect(resolveImportVendor('', vendors)).toBeUndefined();
  });
  it('rejects ambiguous vendor names rather than choosing a record arbitrarily', () => {
    expect(() => resolveImportVendor('Vendor A', [...vendors, { id: 'other', name: 'vendor a' }])).toThrow('multiple records');
  });
});

describe('inventory metal imports', () => {
  it('normalizes Silver and Gold while preserving gold purity classifications', () => {
    expect(parseInventoryMetal('Silver')).toBe('silver');
    expect(parseInventoryMetal('silver')).toBe('silver');
    expect(parseInventoryMetal('GOLD')).toBe('gold_22k');
    expect(parseInventoryMetal('Gold', '18K')).toBe('gold_18k');
    expect(parseInventoryMetal('gold_24k')).toBe('gold_24k');
  });
  it('rejects invalid explicit metal values', () => {
    expect(() => parseInventoryMetal('Platinum')).toThrow('Invalid Metal');
  });
  it('keeps old templates compatible with an unspecified metal', () => {
    const row = parseInventoryCSV('SKU,Product Name,Vendor\nSKU001,Silver Ring,Vendor A')[0];
    expect(row.metal_type).toBeUndefined();
    expect(row._vendor_name).toBe('Vendor A');
  });
  it('reads the added Metal column without changing flat-price inputs', () => {
    const row = parseInventoryCSV('SKU,Product Name,Mode,Vendor,List Price,Purchase Price,Metal\nSKU001,Ring,Flat Price,Vendor A,4940,200,Gold')[0];
    expect(row).toMatchObject({ pricing_mode: 'flat_price', selling_price: 4940, purchase_price: 200, metal_type: 'gold_22k', _vendor_name: 'Vendor A' });
  });
  it('uses separate existing Silver and gold purity rates', () => {
    const base = { silver: 260, gold22: 14300 };
    expect(resolveMetalRate(parseInventoryMetal('Silver') || 'silver', base)).toBe(260);
    expect(resolveMetalRate(parseInventoryMetal('Gold', '18K') || 'silver', base)).toBe(11700);
    expect(resolveMetalRate(parseInventoryMetal('Gold', '24K') || 'silver', base)).toBe(15600);
  });
});