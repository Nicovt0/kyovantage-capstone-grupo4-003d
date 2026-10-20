import { useMutation, useQueryClient } from '@tanstack/react-query';
import { payAgendaOccurrence } from '@/modules/agenda/services/eventRepository';
import { queryKeys } from '@/lib/queryKeys';
import type { Account, RecurringTemplate } from '@/types';

export interface MarkEventAsPaidInput {
  templateId?: string;
  id?: string;
  occurrenceDate?: string;
  accountId: string;
  amount?: number;
}

/**
 * Hook to mark an agenda commitment/occurrence as paid with atomic accounting,
 * optimistic account balance deduction, and immediate UI cache invalidation.
 */
export function useMarkEventAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkEventAsPaidInput) => {
      const templateId = input.templateId || input.id;
      if (!templateId) throw new Error('Identificador de compromiso no especificado.');

      const occurrenceDate =
        input.occurrenceDate || new Date().toISOString().split('T')[0];

      return payAgendaOccurrence({
        id: templateId,
        occurrenceDate,
        accountId: input.accountId,
      });
    },
    onMutate: async (input) => {
      const templateId = input.templateId || input.id;
      const occurrenceDate =
        input.occurrenceDate || new Date().toISOString().split('T')[0];

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.agenda.all }),
        queryClient.cancelQueries({ queryKey: ['agenda'] }),
        queryClient.cancelQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.cancelQueries({ queryKey: ['accounts'] }),
      ]);

      const previousAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.wallet.accounts()) ||
        queryClient.getQueryData<Account[]>(['accounts']);

      // Optimistic balance deduction if amount or account was provided
      if (previousAccounts && input.accountId && input.amount && input.amount > 0) {
        const optimistic = previousAccounts.map((account) => {
          if (account.id === input.accountId) {
            const nextBalance = (account.balance || 0) - input.amount!;
            return { ...account, balance: nextBalance, current_balance: nextBalance };
          }
          return account;
        });

        queryClient.setQueryData(queryKeys.wallet.accounts(), optimistic);
        queryClient.setQueryData(['accounts'], optimistic);
      }

      return { previousAccounts, templateId, occurrenceDate };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.wallet.accounts(), context.previousAccounts);
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
    },
    onSuccess: async () => {
      await Promise.all([
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
    },
    onSettled: async () => {
      await Promise.all([
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
    },
  });
}
