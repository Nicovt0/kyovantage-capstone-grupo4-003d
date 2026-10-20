import { useQuery } from '@tanstack/react-query';
import { getCreditCards } from '@/features/credit-cards/api/creditCardRepository';
import { queryKeys } from '@/lib/queryKeys';
import { CreditCard } from '@/types';

export interface UseCreditCardsOptions<TData = CreditCard[]> {
  select?: (data: CreditCard[]) => TData;
  enabled?: boolean;
}

export function useCreditCards<TData = CreditCard[]>(options?: UseCreditCardsOptions<TData>) {
  return useQuery({
    queryKey: queryKeys.wallet.creditCards(),
    queryFn: () => getCreditCards(),
    select: options?.select,
    enabled: options?.enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,  // 30 minutes
  });
}
