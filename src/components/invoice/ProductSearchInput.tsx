import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { Product } from '@/types/invoice';

interface ProductSearchInputProps {
  products: Product[];
  onSelect: (product: Product) => void;
  placeholder?: string;
}

export function ProductSearchInput({
  products,
  onSelect,
  placeholder = 'Search by SKU or product name...',
}: ProductSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = searchTerm.length >= 1
    ? products.filter(
        (p) =>
          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredProducts.length]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredProducts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % filteredProducts.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length);
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(filteredProducts[highlightedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => searchTerm && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>

      {isOpen && filteredProducts.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {filteredProducts.map((product, index) => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              className={`w-full px-3 py-2 text-left hover:bg-accent transition-colors ${
                index === highlightedIndex ? 'bg-accent' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                  <p className="font-medium text-sm">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.weight_grams}g • {product.categories?.name || 'Uncategorized'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Stock</p>
                  <p className="font-medium text-sm">{product.quantity}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm.length >= 1 && filteredProducts.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg p-4 text-center text-muted-foreground text-sm">
          No products found matching "{searchTerm}"
        </div>
      )}
    </div>
  );
}
