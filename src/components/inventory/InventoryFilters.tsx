import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { TYPE_OF_WORK_OPTIONS, STATUS_OPTIONS } from '@/types/inventory';

interface Category {
  id: string;
  name: string;
}

interface Filters {
  search: string;
  category: string;
  status: string;
  typeOfWork: string;
}

interface InventoryFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  categories: Category[];
}

export function InventoryFilters({ filters, onFiltersChange, categories }: InventoryFiltersProps) {
  const updateFilter = (key: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, SKU, description, or vendor..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10"
        />
      </div>
      
      <Select value={filters.category} onValueChange={(v) => updateFilter('category', v)}>
        <SelectTrigger className="w-full lg:w-44">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
        <SelectTrigger className="w-full lg:w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select value={filters.typeOfWork} onValueChange={(v) => updateFilter('typeOfWork', v)}>
        <SelectTrigger className="w-full lg:w-40">
          <SelectValue placeholder="Type of Work" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {TYPE_OF_WORK_OPTIONS.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
