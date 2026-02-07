import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { STATUS_OPTIONS } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';

interface Category {
  id: string;
  name: string;
  parent_id?: string | null;
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
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchTypes = async () => {
      const { data } = await supabase.from('types_of_work').select('name').order('name');
      setTypeOfWorkOptions((data || []).map(d => d.name));
    };
    fetchTypes();
  }, []);

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
          {categories.filter(c => !c.parent_id).map((cat) => {
            const subs = categories.filter(c => c.parent_id === cat.id);
            return (
              <div key={cat.id}>
                <SelectItem value={cat.id}>{cat.name}</SelectItem>
                {subs.map((sub) => {
                  const subSubs = categories.filter(c => c.parent_id === sub.id);
                  return (
                    <div key={sub.id}>
                      <SelectItem value={sub.id}>↳ {sub.name}</SelectItem>
                      {subSubs.map((subSub) => (
                        <SelectItem key={subSub.id} value={subSub.id}>↳↳ {subSub.name}</SelectItem>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
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
          {typeOfWorkOptions.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
