import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/features/wallet/api/transactionRepository';
import { queryKeys } from '@/lib/queryKeys';
import type { Account, Transaction } from '@/types';

/**
 * Standard list of query keys that must be invalidated on any financial mutation
 * to ensure accounting consistency and immediate UI reactivity.
 */
export async function invalidateFinancialCaches(queryClient: ReturnType<typeof useQueryClient>) {
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
}

/**
 * Optimistic mutation hook for creating a transaction.
 * Reactively recalculates account balances in memory before network completion.
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transaction: Omit<Transaction, 'id'>) => addTransaction(transaction),
    onMutate: async (newTx) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.cancelQueries({ queryKey: ['accounts'] }),
      ]);

      const previousAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.wallet.accounts()) ||
        queryClient.getQueryData<Account[]>(['accounts']);

      if (previousAccounts && (newTx.status === 'paid' || newTx.status === undefined)) {
        const optimistic = previousAccounts.map((account) => {
          if (newTx.type === 'expense' && account.id === newTx.account_id) {
            const nextBalance = (account.balance || 0) - newTx.amount;
            return { ...account, balance: nextBalance, current_balance: nextBalance };
          }
          if (newTx.type === 'income' && account.id === newTx.account_id) {
            const nextBalance = (account.balance || 0) + newTx.amount;
            return { ...account, balance: nextBalance, current_balance: nextBalance };
          }
          if (newTx.type === 'transfer') {
            const srcId = newTx.source_account_id || newTx.account_id;
            const dstId = newTx.destination_account_id;
            if (account.id === srcId) {
              const nextBalance = (account.balance || 0) - newTx.amount;
              return { ...account, balance: nextBalance, current_balance: nextBalance };
            }
            if (account.id === dstId) {
              const nextBalance = (account.balance || 0) + newTx.amount;
              return { ...account, balance: nextBalance, current_balance: nextBalance };
            }
          }
          return account;
        });

        queryClient.setQueryData(queryKeys.wallet.accounts(), optimistic);
        queryClient.setQueryData(['accounts'], optimistic);
      }

      return { previousAccounts };
    },
    onError: (_err, _newTx, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.wallet.accounts(), context.previousAccounts);
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
    },
    onSuccess: async () => {
      await invalidateFinancialCaches(queryClient);
    },
    onSettled: async () => {
      await invalidateFinancialCaches(queryClient);
    },
  });
}

export interface UpdateTransactionVariables {
  id: string;
  updates: Partial<Transaction>;
  oldTransaction?: Transaction;
}

/**
 * Optimistic mutation hook for updating a transaction.
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: UpdateTransactionVariables) => updateTransaction(id, updates),
    onMutate: async ({ id, updates, oldTransaction }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.cancelQueries({ queryKey: ['accounts'] }),
        queryClient.cancelQueries({ queryKey: queryKeys.wallet.transactions() }),
        queryClient.cancelQueries({ queryKey: ['transactions'] }),
      ]);

      const previousAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.wallet.accounts()) ||
        queryClient.getQueryData<Account[]>(['accounts']);

      const previousTransactions =
        queryClient.getQueryData<Transaction[]>(queryKeys.wallet.transactions()) ||
        queryClient.getQueryData<Transaction[]>(['transactions']);

      // Optimistically update transactions list
      if (previousTransactions) {
        const nextTx = previousTransactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx
        );
        queryClient.setQueryData(queryKeys.wallet.transactions(), nextTx);
        queryClient.setQueryData(['transactions'], nextTx);
      }

      // Optimistically adjust accounts if old transaction info was supplied
      if (previousAccounts && oldTransaction) {
        const nextAmount = updates.amount !== undefined ? updates.amount : oldTransaction.amount;
        const nextAccountId = updates.account_id !== undefined ? updates.account_id : oldTransaction.account_id;
        const nextStatus = updates.status !== undefined ? updates.status : oldTransaction.status;
        const type = updates.type !== undefined ? updates.type : oldTransaction.type;

        const optimistic = previousAccounts.map((account) => {
          let bal = account.balance || 0;
          // Revert old effect
          if (oldTransaction.status === 'paid' && account.id === oldTransaction.account_id) {
            bal += oldTransaction.type === 'expense' ? oldTransaction.amount : -oldTransaction.amount;
          }
          // Apply new effect
          if (nextStatus === 'paid' && account.id === nextAccountId) {
            bal += type === 'expense' ? -nextAmount : nextAmount;
          }
          return bal !== account.balance ? { ...account, balance: bal, current_balance: bal } : account;
        });

        queryClient.setQueryData(queryKeys.wallet.accounts(), optimistic);
        queryClient.setQueryData(['accounts'], optimistic);
      }

      return { previousAccounts, previousTransactions };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.wallet.accounts(), context.previousAccounts);
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKeys.wallet.transactions(), context.previousTransactions);
        queryClient.setQueryData(['transactions'], context.previousTransactions);
      }
    },
    onSuccess: async () => {
      await invalidateFinancialCaches(queryClient);
    },
    onSettled: async () => {
      await invalidateFinancialCaches(queryClient);
    },
  });
}

export interface DeleteTransactionVariables {
  id: string;
  revertBalance?: boolean;
  transaction?: Transaction;
}

/**
 * Optimistic mutation hook for deleting a transaction.
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, revertBalance }: DeleteTransactionVariables) =>
      deleteTransaction(id, revertBalance ?? true),
    onMutate: async ({ id, revertBalance, transaction }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.wallet.accounts() }),
        queryClient.cancelQueries({ queryKey: ['accounts'] }),
        queryClient.cancelQueries({ queryKey: queryKeys.wallet.transactions() }),
        queryClient.cancelQueries({ queryKey: ['transactions'] }),
      ]);

      const previousAccounts =
        queryClient.getQueryData<Account[]>(queryKeys.wallet.accounts()) ||
        queryClient.getQueryData<Account[]>(['accounts']);

      const previousTransactions =
        queryClient.getQueryData<Transaction[]>(queryKeys.wallet.transactions()) ||
        queryClient.getQueryData<Transaction[]>(['transactions']);

      if (previousTransactions) {
        const nextTx = previousTransactions.filter((tx) => tx.id !== id);
        queryClient.setQueryData(queryKeys.wallet.transactions(), nextTx);
        queryClient.setQueryData(['transactions'], nextTx);
      }

      const txToRevert = transaction || previousTransactions?.find((t) => t.id === id);
      if (previousAccounts && txToRevert && (revertBalance ?? true) && (txToRevert.status === 'paid' || txToRevert.status === undefined)) {
        const optimistic = previousAccounts.map((account) => {
          if (account.id === txToRevert.account_id) {
            const nextBalance = txToRevert.type === 'expense'
              ? (account.balance || 0) + txToRevert.amount
              : (account.balance || 0) - txToRevert.amount;
            return { ...account, balance: nextBalance, current_balance: nextBalance };
          }
          return account;
        });

        queryClient.setQueryData(queryKeys.wallet.accounts(), optimistic);
        queryClient.setQueryData(['accounts'], optimistic);
      }

      return { previousAccounts, previousTransactions };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.wallet.accounts(), context.previousAccounts);
        queryClient.setQueryData(['accounts'], context.previousAccounts);
      }
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKeys.wallet.transactions(), context.previousTransactions);
        queryClient.setQueryData(['transactions'], context.previousTransactions);
      }
    },
    onSuccess: async () => {
      await invalidateFinancialCaches(queryClient);
    },
    onSettled: async () => {
      await invalidateFinancialCaches(queryClient);
    },
  });
}
