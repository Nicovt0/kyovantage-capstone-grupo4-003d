import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getAccounts } from '@/features/wallet/api/accountRepository';
import { getCreditCards } from '@/features/credit-cards/api/creditCardRepository';
import { getTransactions } from '@/features/wallet/api/transactionRepository';
import { getCategories } from '@/features/budget/api/categoryRepository';
import { getBudgets } from '@/features/budget/api/budgetRepository';
import { getBanks } from '@/features/wallet/api/bankRepository';
import { getUpcomingTemplates } from '@/modules/agenda/services/eventRepository';

export const DEFAULT_PREFETCH_STALE_TIME = 1000 * 60 * 5; // 5 minutos

/**
 * Anticipatory prefetching of queries for a target route.
 * Executed on link hover/focus (SideNav/BottomNav) or preloaded on AppShell idle.
 */
export async function prefetchRoute(
  client: QueryClient,
  route: string,
  userId?: string
): Promise<void> {
  if (!client || !route) return;

  try {
    if (route.startsWith('/agenda')) {
      const now = new Date();
      const targetYear = now.getFullYear();
      const targetMonth = now.getMonth() + 1;
      const userKey = userId || 'session';
      const agendaKey = ['agenda', 'templates', userKey, targetMonth, targetYear] as const;
      const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      await Promise.allSettled([
        client.prefetchQuery({
          queryKey: agendaKey,
          queryFn: () => getUpcomingTemplates(userId || '', startDate, endDate),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.wallet.accounts(),
          queryFn: () => getAccounts(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
      ]);
    } else if (route.startsWith('/wallet')) {
      await Promise.allSettled([
        client.prefetchQuery({
          queryKey: queryKeys.wallet.accounts(),
          queryFn: () => getAccounts(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.wallet.creditCards(),
          queryFn: () => getCreditCards(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.wallet.transactions(),
          queryFn: () => getTransactions(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.budget.categories(),
          queryFn: () => getCategories(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.banks.all,
          queryFn: () => getBanks(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
      ]);
    } else if (route.startsWith('/dashboard')) {
      await Promise.allSettled([
        client.prefetchQuery({
          queryKey: queryKeys.wallet.accounts(),
          queryFn: () => getAccounts(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.wallet.creditCards(),
          queryFn: () => getCreditCards(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.wallet.transactions(),
          queryFn: () => getTransactions(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.budget.categories(),
          queryFn: () => getCategories(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
        client.prefetchQuery({
          queryKey: queryKeys.budget.budgets(),
          queryFn: () => getBudgets(),
          staleTime: DEFAULT_PREFETCH_STALE_TIME,
        }),
      ]);
    }
  } catch (error) {
    // Non-blocking catch to prevent prefetch failures from disrupting user experience
    console.debug('[Prefetch] Error while prefetching route:', route, error);
  }
}

/**
 * Anticipatory precache of critical routes in the background during idle time.
 */
export async function prefetchCriticalRoutes(
  client: QueryClient,
  userId?: string
): Promise<void> {
  if (!client) return;

  await Promise.allSettled([
    prefetchRoute(client, '/dashboard', userId),
    prefetchRoute(client, '/wallet', userId),
    prefetchRoute(client, '/agenda', userId),
  ]);
}
