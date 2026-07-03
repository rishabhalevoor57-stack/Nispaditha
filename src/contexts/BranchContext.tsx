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
  status: string;
  is_default: boolean;
}

/**
 * currentBranchId === null means "All Branches" (admin only).
 * When there is exactly one branch and the user is not admin, it stays pinned to that branch.
 */
interface BranchContextValue {
  branches: Branch[];
  currentBranch: Branch | null;
  currentBranchId: string | null;
  isAllBranches: boolean;
  loading: boolean;
  setCurrentBranchId: (id: string | null) => void;
  refresh: () => Promise<void>;
  defaultBranch: Branch | null;
}

const BranchContext = createContext<BranchContextValue | undefined>(undefined);

const STORAGE_KEY = 'nispaditha.currentBranchId';

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user, userRole } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBranchId, setCurrentBranchIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v !== 'ALL' ? v : v === 'ALL' ? null : null;
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  // If no branch chosen yet, default to the default branch for non-admins.
  useEffect(() => {
    if (loading || branches.length === 0) return;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'ALL' && userRole === 'admin') {
      setCurrentBranchIdState(null);
      return;
    }
    if (currentBranchId && branches.some((b) => b.id === currentBranchId)) return;
    const def = branches.find((b) => b.is_default) ?? branches[0];
    setCurrentBranchIdState(def?.id ?? null);
  }, [branches, loading, userRole, currentBranchId]);

  const setCurrentBranchId = useCallback((id: string | null) => {
    setCurrentBranchIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id === null ? 'ALL' : id);
    }
  }, []);

  const value = useMemo<BranchContextValue>(() => {
    const currentBranch = branches.find((b) => b.id === currentBranchId) ?? null;
    const defaultBranch = branches.find((b) => b.is_default) ?? branches[0] ?? null;
    return {
      branches,
      currentBranch,
      currentBranchId,
      isAllBranches: currentBranchId === null && !!user,
      loading,
      setCurrentBranchId,
      refresh,
      defaultBranch,
    };
  }, [branches, currentBranchId, loading, setCurrentBranchId, refresh, user]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
};
