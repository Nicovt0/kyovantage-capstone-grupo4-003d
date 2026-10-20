import { useQuery } from '@tanstack/react-query';
import { getPendingBillingStatements } from '@/features/credit-cards/api/billingRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { creditCardQueryKeys } from '@/features/credit-cards/model/queryKeys';

export function useBillingStatements() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: creditCardQueryKeys.billingStatements(auth.id),
    queryFn: () => getPendingBillingStatements(),
  });
}
