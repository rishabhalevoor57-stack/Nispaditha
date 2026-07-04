import { useBranch, applyBranchFilter } from '@/contexts/BranchContext';

/**
 * Convenience hook. Returns:
 *  - branchId: id to send in inserts (defaults to current or Main)
 *  - filterId: id to filter list queries by, or null for "all branches"
 *  - apply(query): applies the branch filter to a Supabase select builder
 *  - isAll: true when viewing All Branches
 *  - isInactive / isReadOnly: pass-through flags for UI gating
 */
export function useBranchFilter() {
  const { currentBranchId, branchFilterId, defaultBranch, isAllBranches, isInactive, isReadOnly } = useBranch();
  const branchId = currentBranchId ?? defaultBranch?.id ?? null;
  const defaultBranchId = defaultBranch?.id ?? null;
  return {
    branchId,
    filterId: branchFilterId,
    isAll: isAllBranches,
    isInactive,
    isReadOnly,
    apply: <T extends { or: (...a: any[]) => any; eq: (...a: any[]) => any }>(q: T) =>
      applyBranchFilter(q, branchFilterId, defaultBranchId),
  };
}
