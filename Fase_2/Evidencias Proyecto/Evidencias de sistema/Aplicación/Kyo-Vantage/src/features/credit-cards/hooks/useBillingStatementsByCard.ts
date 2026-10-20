import { useQuery } from '@tanstack/react-query';
import { getBillingStatementsByCard } from '@/features/credit-cards/api/billingRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { creditCardQueryKeys } from '@/features/credit-cards/model/queryKeys';

export function useBillingStatementsByCard(cardId: string | null) {
  const { auth } = useAuth();

  return useQuery({
    queryKey: creditCardQueryKeys.billingStatementsByCard(auth.id, cardId || 'missing'),
    queryFn: () => getBillingStatementsByCard(cardId as string),
    enabled: Boolean(cardId),
  });
}
