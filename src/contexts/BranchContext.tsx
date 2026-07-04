import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  manager_id: string | null;
  status: string; // 'active' | 'inactive' | 'archived'
  is_default: boolean;
}

interface BranchContextValue {
  branches: Branch[];
  currentBranch: Branch | null;
  currentBranchId: string | null;
  /** Convenience: the id to filter server queries by, or null for "all branches". */
  branchFilterId: string | null;
  isAllBranches: boolean;
  /** Current branch is inactive — new records should be blocked. */
  isInactive: boolean;
  /** Current branch is archived — all writes should be blocked (read-only). */
  isReadOnly: boolean;
  loading: boolean;
  setCurrentBranchId: (id: string | null) => void;
  refresh: () => Promise<void>;
  defaultBranch: Branch | null;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

const STORAGE_KEY = 'nispaditha.currentBranchId';

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBranchId, setCurrentBranchIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v !== 'ALL' ? v : null;
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setBranches([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });
    if (!error && data) setBranches(data as Branch[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (loading || branches.length === 0) return;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'ALL' && isAdmin) {
      setCurrentBranchIdState(null);
      return;
    }
    if (currentBranchId && branches.some((b) => b.id === currentBranchId)) return;
    const def = branches.find((b) => b.is_default) ?? branches[0];
    setCurrentBranchIdState(def?.id ?? null);
  }, [branches, loading, isAdmin, currentBranchId]);

  const setCurrentBranchId = useCallback((id: string | null) => {
    setCurrentBranchIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id === null ? 'ALL' : id);
    }
  }, []);

  const value = useMemo<BranchContextValue>(() => {
    const currentBranch = branches.find((b) => b.id === currentBranchId) ?? null;
    const defaultBranch = branches.find((b) => b.is_default) ?? branches[0] ?? null;
    const isAllBranches = currentBranchId === null && !!user && isAdmin;
    return {
      branches,
      currentBranch,
      currentBranchId,
      branchFilterId: isAllBranches ? null : currentBranchId,
      isAllBranches,
      isInactive: currentBranch?.status === 'inactive',
      isReadOnly: currentBranch?.status === 'archived',
      loading,
      setCurrentBranchId,
      refresh,
      defaultBranch,
    };
  }, [branches, currentBranchId, loading, setCurrentBranchId, refresh, user, isAdmin]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
};

/**
 * Small helper used across list pages/hooks to apply a branch filter to a Supabase
 * select query. Pass a builder callback; returns the same query untouched when
 * "All Branches" is selected. Rows with NULL branch_id are always included so
 * legacy data (backfilled to Main) remains visible.
 */
export function applyBranchFilter<T extends { or: (...args: any[]) => any; eq: (...args: any[]) => any }>(
  query: T,
  branchFilterId: string | null,
  defaultBranchId: string | null,
): T {
  if (!branchFilterId) return query;
  // Include rows explicitly at this branch OR unassigned rows that belong to the default branch
  if (branchFilterId === defaultBranchId) {
    return query.or(`branch_id.eq.${branchFilterId},branch_id.is.null`);
  }
  return query.eq('branch_id', branchFilterId) as T;
}
