import { useQuery } from '@tanstack/react-query';
import { getCategories } from '@/features/budget/api/categoryRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { budgetQueryKeys } from '@/features/budget/model/queryKeys';

export function useCategories() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: budgetQueryKeys.categories(auth.id),
    queryFn: () => getCategories(),
    enabled: Boolean(auth.id),
  });
}
