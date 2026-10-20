import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/features/wallet/api/transactionRepository';
import { queryKeys } from '@/lib/queryKeys';
import { Transaction } from '@/types';

export interface UseTransactionsOptions<TData = Transaction[]> {
  select?: (data: Transaction[]) => TData;
  enabled?: boolean;
}

export function useTransactions<TData = Transaction[]>(options?: UseTransactionsOptions<TData>) {
  return useQuery({
    queryKey: queryKeys.wallet.transactions(),
    queryFn: () => getTransactions(),
    select: options?.select,
    enabled: options?.enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,  // 30 minutes
  });
}

export {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  invalidateFinancialCaches,
} from './useTransactionMutations';

