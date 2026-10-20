import { useQuery } from '@tanstack/react-query';
import { getGoals } from '@/features/goals/api/goalRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { goalQueryKeys } from '@/features/goals/model/queryKeys';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';

export function useGoals() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: goalQueryKeys.all(auth.id),
    queryFn: () => getGoals(),
    enabled: USE_MOCKS || Boolean(auth.id),
  });
}
