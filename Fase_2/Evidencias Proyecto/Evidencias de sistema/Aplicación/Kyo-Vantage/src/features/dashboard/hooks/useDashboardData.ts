import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useGoals } from '@/features/goals/hooks/useGoals';
import { useBudgets } from '@/features/budget/hooks/useBudgets';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { useBanks } from '@/features/wallet/hooks/useBanks';
import { useBillingStatements } from '@/features/credit-cards/hooks/useBillingStatements';

export function useDashboardData() {
  const accountsQuery = useAccounts();
  const creditCardsQuery = useCreditCards();
  const transactionsQuery = useTransactions();
  const goalsQuery = useGoals();
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories();
  const banksQuery = useBanks();
  const billingStatementsQuery = useBillingStatements();

  const isLoading =
    accountsQuery.isLoading ||
    creditCardsQuery.isLoading ||
    transactionsQuery.isLoading ||
    goalsQuery.isLoading ||
    budgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    banksQuery.isLoading ||
    billingStatementsQuery.isLoading;

  const isError =
    accountsQuery.isError ||
    creditCardsQuery.isError ||
    transactionsQuery.isError ||
    goalsQuery.isError ||
    budgetsQuery.isError ||
    categoriesQuery.isError ||
    banksQuery.isError ||
    billingStatementsQuery.isError;

  return {
    isLoading,
    isError,
    data: isLoading ? null : {
      accounts: accountsQuery.data || [],
      creditCards: creditCardsQuery.data || [],
      transactions: transactionsQuery.data || [],
      goals: goalsQuery.data || [],
      budgets: budgetsQuery.data || [],
      categories: categoriesQuery.data || [],
      banks: banksQuery.data || [],
      billingStatements: billingStatementsQuery.data || [],
    },
    refetchAll: () => {
      accountsQuery.refetch();
      creditCardsQuery.refetch();
      transactionsQuery.refetch();
      goalsQuery.refetch();
      budgetsQuery.refetch();
      categoriesQuery.refetch();
      banksQuery.refetch();
      billingStatementsQuery.refetch();
    }
  };
}
