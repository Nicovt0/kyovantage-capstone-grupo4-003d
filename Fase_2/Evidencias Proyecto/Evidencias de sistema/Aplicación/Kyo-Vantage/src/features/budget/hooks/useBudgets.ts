import { useQuery } from '@tanstack/react-query';
import { getBudgets } from '@/features/budget/api/budgetRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { budgetQueryKeys } from '@/features/budget/model/queryKeys';

export function useBudgets() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: budgetQueryKeys.budgets(auth.id),
    queryFn: () => getBudgets(),
  });
}
