import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, financialCycleForMonth } from '@/utils/financialCycle';
import { goalQueryKeys } from '@/features/goals/model/queryKeys';
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUpcomingTemplates,
  createRecurringTemplate,
  updateRecurringTemplateStatus,
  deleteRecurringTemplate,
  updateRecurringTemplate,
  payAgendaOccurrence,
} from '@/modules/agenda/services/eventRepository';
import { RecurringTemplate, CreateRecurringTemplateDTO, UpdateRecurringTemplateDTO } from '@/types';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { queryKeys } from '@/lib/queryKeys';

export interface UseAgendaEventsParams<TData = RecurringTemplate[]> {
  month?: number; // 1-12
  year?: number;  // e.g. 2026
  select?: (data: RecurringTemplate[]) => TData;
}

const EMPTY_EVENTS: RecurringTemplate[] = [];

/**
 * React hook to manage Agenda events (recurring commitments) with TanStack Query v5.
 * Uses queryKey ['agenda', 'templates', userKey, targetMonth, targetYear, cycleStartDay] and provides optimistic mutations.
 * [SP2-09]: Re-render audit & centralized cache invalidation.
 */
export function useAgendaEvents<TData = RecurringTemplate[]>(params?: UseAgendaEventsParams<TData>) {
  const queryClient = useQueryClient();
  const { auth } = useAuth();

  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const now = getFinancialCycle(new Date(), cycleStartDay).start;
  const targetYear = params?.year ?? now.getFullYear();
  const targetMonth = params?.month ?? (now.getMonth() + 1);

  const { start: startDate, end: endDate } = financialCycleForMonth(targetYear, targetMonth - 1, cycleStartDay);

  const userKey = auth?.id || 'session';
  const queryKey = ['agenda', 'templates', userKey, targetMonth, targetYear, cycleStartDay] as const;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<RecurringTemplate[]> => {
      let userId: string | undefined = auth?.id;

      if (!userId && !USE_MOCKS) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        }
      }

      if (!userId && USE_MOCKS) {
        userId = 'user-mock-1';
      }

      if (!userId) {
        return [];
      }

      return getUpcomingTemplates(userId, startDate, endDate);
    },
    select: params?.select as any,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,  // 30 minutes
  });

  // Mutación: Pago de compromiso (afecta agenda, cuentas, transacciones y dashboard)
  const payMutation = useMutation({
    mutationFn: payAgendaOccurrence,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey:goalQueryKeys.all(auth.id)}),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.transactions() }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet.summary() }),
        queryClient.invalidateQueries({ queryKey: ['agenda'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
    },
  });

  // Mutación: Crear compromiso (solo afecta agenda)
  const createMutation = useMutation({
    mutationFn: async (data: CreateRecurringTemplateDTO) => {
      let userId: string | undefined = auth?.id;
      if (!userId && !USE_MOCKS) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        }
      }
      return createRecurringTemplate({
        ...data,
        user_id: userId || data.user_id || 'user-mock-1',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });

  // Mutación: Actualizar estado con optimismo
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'paid' | 'overdue' }) =>
      updateRecurringTemplateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousEvents = queryClient.getQueryData<RecurringTemplate[]>(queryKey);

      if (previousEvents) {
        queryClient.setQueryData<RecurringTemplate[]>(
          queryKey,
          previousEvents.map((event) =>
            event.id === id ? { ...event, status } : event
          )
        );
      }

      return { previousEvents };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(queryKey, context.previousEvents);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });

  // Mutación: Posponer compromiso a nueva fecha o día
  const postponeMutation = useMutation({
    mutationFn: ({
      id,
      newDate,
      newPaymentDay,
    }: {
      id: string;
      newDate?: string;
      newPaymentDay?: number;
    }) => {
      const updates: UpdateRecurringTemplateDTO = {
        status: 'pending',
      };
      if (newDate) updates.due_date = newDate;
      if (newPaymentDay !== undefined) updates.payment_day = newPaymentDay;
      return updateRecurringTemplate(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });

  // Mutación: Eliminar compromiso
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurringTemplate(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });

      const previousEvents = queryClient.getQueryData<RecurringTemplate[]>(queryKey);

      if (previousEvents) {
        queryClient.setQueryData<RecurringTemplate[]>(
          queryKey,
          previousEvents.filter((event) => event.id !== id)
        );
      }

      return { previousEvents };
    },
    onError: (_err, _id, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(queryKey, context.previousEvents);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });

  // Mutación: Edición completa del compromiso
  const updateCommitmentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRecurringTemplateDTO }) =>
      updateRecurringTemplate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });

  const createCommitment = createMutation.mutateAsync;
  const updateStatus = updateStatusMutation.mutateAsync;
  const payCommitment = payMutation.mutateAsync;
  const postponeCommitment = postponeMutation.mutateAsync;
  const deleteCommitment = deleteMutation.mutateAsync;
  const updateCommitment = updateCommitmentMutation.mutateAsync;

  const rawData = query.data;
  const events = (rawData ?? (EMPTY_EVENTS as unknown as TData)) as unknown as RecurringTemplate[];

  const isUpdatingStatus = updateStatusMutation.isPending || payMutation.isPending;

  return useMemo(
    () => ({
      events,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
      targetMonth,
      targetYear,

      // Mutation triggers with stable references
      createCommitment,
      isCreating: createMutation.isPending,

      updateStatus,
      isUpdatingStatus,
      payCommitment,
      isPaying: payMutation.isPending,

      postponeCommitment,
      isPostponing: postponeMutation.isPending,

      deleteCommitment,
      isDeleting: deleteMutation.isPending,

      updateCommitment,
      isUpdating: updateCommitmentMutation.isPending,
    }),
    [
      events,
      query.isLoading,
      query.isFetching,
      query.isError,
      query.error,
      query.refetch,
      targetMonth,
      targetYear,
      createCommitment,
      createMutation.isPending,
      updateStatus,
      isUpdatingStatus,
      payCommitment,
      payMutation.isPending,
      postponeCommitment,
      postponeMutation.isPending,
      deleteCommitment,
      deleteMutation.isPending,
      updateCommitment,
      updateCommitmentMutation.isPending,
    ]
  );
}

export { useMarkEventAsPaid } from './useMarkEventAsPaid';
