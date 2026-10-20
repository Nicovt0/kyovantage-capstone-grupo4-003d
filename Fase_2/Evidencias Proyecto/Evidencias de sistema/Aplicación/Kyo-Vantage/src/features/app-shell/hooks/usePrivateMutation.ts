import { goalQueryKeys } from '@/features/goals/model/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { queryKeys } from '@/lib/queryKeys';

type PrivateOperation = () => Promise<unknown>;

/**
 * Hook for executing private mutations with targeted cache invalidation.
 * [SP2-09]: Centralizes and scopes invalidation to only affected queries.
 */
export function usePrivateMutation(customQueryKeys?: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  const { auth } = useAuth();

  const mutation = useMutation<unknown, Error, PrivateOperation>({
    mutationFn: (operation) => operation(),
    onSuccess: async () => {
      const keysToInvalidate = customQueryKeys && customQueryKeys.length > 0
        ? customQueryKeys
        : [
            goalQueryKeys.all(auth.id),
            queryKeys.wallet.accounts(),
            ['accounts'] as const,
            queryKeys.wallet.transactions(),
            ['transactions'] as const,
            queryKeys.wallet.summary(),
            ['availability'] as const,
            queryKeys.agenda.all,
            ['agenda'] as const,
            queryKeys.dashboard.all,
            queryKeys.wallet.all,
          ];

      await Promise.all(
        keysToInvalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      );
    },
  });

  const runMutation = mutation.mutateAsync as <T>(
    operation: () => Promise<T>,
  ) => Promise<T>;

  return { ...mutation, runMutation };
}
