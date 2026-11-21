import { describe, expect, it } from 'vitest';
import {
  buildSupplierNameIndex,
  findVendorColumnIndex,
  hasVendorLikeHeader,
  resolveVendorName,
} from '@/lib/inventoryImportVendors';

describe('bulk import vendor matching', () => {
  it('matches saved vendors despite capitalization and extra whitespace', () => {
    const index = buildSupplierNameIndex([{ id: 'vendor-1', name: 'Vendor Name' }]);
    expect(resolveVendorName('  VENDOR   NAME  ', index)).toEqual({ status: 'matched', supplierId: 'vendor-1' });
  });

  it('selects the vendor name column instead of a vendor code column', () => {
    expect(findVendorColumnIndex(['SKU', 'Vendor Code', 'Vendor Name'])).toBe(2);
    expect(findVendorColumnIndex(['SKU', 'Vendor Code'])).toBe(-1);
    expect(hasVendorLikeHeader(['SKU', 'Vendor Code'])).toBe(true);
  });

  it('rejects vendor names that are not saved', () => {
    const index = buildSupplierNameIndex([{ id: 'vendor-1', name: 'Vendor Name' }]);
    expect(resolveVendorName('Unknown Vendor', index)).toEqual({ status: 'unknown', vendorName: 'Unknown Vendor' });
  });

  it('rejects names that match multiple saved vendors', () => {
    const index = buildSupplierNameIndex([
      { id: 'vendor-1', name: 'Vendor Name' },
      { id: 'vendor-2', name: ' VENDOR   NAME ' },
    ]);
    expect(resolveVendorName('Vendor Name', index)).toEqual({ status: 'ambiguous', vendorName: 'Vendor Name' });
  });

  it('preserves the existing vendor when the import cell is blank', () => {
    const index = buildSupplierNameIndex([{ id: 'vendor-1', name: 'Vendor Name' }]);
    expect(resolveVendorName('   ', index, 'existing-vendor')).toEqual({
      status: 'blank',
      supplierId: 'existing-vendor',
    });
  });
});