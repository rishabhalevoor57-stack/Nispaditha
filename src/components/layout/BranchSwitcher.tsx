import { Building2, Check, ChevronDown } from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const BranchSwitcher = () => {
  const { branches, currentBranch, currentBranchId, setCurrentBranchId, isAllBranches, loading } = useBranch();
  const { userRole } = useAuth();

  if (loading || branches.length === 0) return null;

  const label = isAllBranches ? 'All Branches' : currentBranch?.name ?? 'Select branch';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[220px]">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userRole === 'admin' && (
          <DropdownMenuItem onClick={() => setCurrentBranchId(null)}>
            <span className="flex-1">All Branches</span>
            {isAllBranches && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        )}
        {branches.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => setCurrentBranchId(b.id)}>
            <div className="flex-1 min-w-0">
              <div className="truncate">{b.name}</div>
              <div className="text-xs text-muted-foreground truncate">{b.code}</div>
            </div>
            {currentBranchId === b.id && <Check className="w-4 h-4 ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
