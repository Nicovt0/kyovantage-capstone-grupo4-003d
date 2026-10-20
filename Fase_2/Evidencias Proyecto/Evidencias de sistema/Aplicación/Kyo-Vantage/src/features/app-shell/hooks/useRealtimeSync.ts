import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Subscribes to Supabase Realtime changes on `accounts` and `transactions` tables.
 * Whenever external modifications (or background engines) change balances or records,
 * all relevant TanStack Query caches are invalidated immediately without a full page reload.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const userId = auth?.id;

  useEffect(() => {
    if (USE_MOCKS || !userId) return;

    const supabase = createClient();
    const channelName = `realtime-balance-sync-${userId}-${Math.random().toString(36).slice(2, 7)}`;

    const invalidateAll = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions() }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary() }),
        queryClient.invalidateQueries({ queryKey: ['agenda'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all }),
      ]);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          invalidateAll();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          invalidateAll();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
