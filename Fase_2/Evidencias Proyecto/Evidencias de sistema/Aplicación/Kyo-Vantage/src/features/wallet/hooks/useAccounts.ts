import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/features/wallet/api/accountRepository';
import { queryKeys } from '@/lib/queryKeys';
import type { Account } from '@/types';
import { selectActiveAccounts, selectAccountsTotalBalance } from '../selectors/accountSelectors';

export { selectActiveAccounts, selectAccountsTotalBalance };

export interface UseAccountsOptions<TData = Account[]> {
  select?: (data: Account[]) => TData;
  enabled?: boolean;
}

/**
 * Hook to retrieve accounts with TanStack Query v5 cache & optional memoized select.
 * [SP2-09]: Re-render audit - supports custom data selectors for reference stability.
 */
export function useAccounts<TData = Account[]>(options?: UseAccountsOptions<TData>) {
  return useQuery({
    queryKey: queryKeys.wallet.accounts(),
    queryFn: () => getAccounts(),
    select: options?.select,
    enabled: options?.enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,  // 30 minutes
  });
}
