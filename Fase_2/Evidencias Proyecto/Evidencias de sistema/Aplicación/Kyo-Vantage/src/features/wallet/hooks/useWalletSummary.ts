import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { isInFinancialCycle } from '@/utils/financialCycle';
import { selectActiveAccounts } from '@/features/wallet/selectors/accountSelectors';
import { useMemo } from 'react';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';

export function useWalletSummary() {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: creditCards = [], isLoading: loadingCards } = useCreditCards();
  const { data: transactions = [], isLoading: loadingTx } = useTransactions();

  const {cycle}=useFinancialPeriod();

  const summary = useMemo(() => {
    // 1. Saldo disponible de cuentas regulares activas
    const activeAccounts = selectActiveAccounts(accounts);
    const totalAvailableBalance = activeAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    // 2. Deuda y cupo total de tarjetas de crédito activas
    const activeCards = creditCards.filter(c => !c.is_archived);
    const totalCreditDebt = activeCards.reduce((sum, c) => sum + (c.current_debt || 0), 0);
    const totalCreditLimit = activeCards.reduce((sum, c) => sum + (c.total_limit || 0), 0);
    const availableCreditLimit = Math.max(0, totalCreditLimit - totalCreditDebt);

    // 3. Patrimonio neto consolidado en RAM
    const netWorth = totalAvailableBalance - totalCreditDebt;

    // 4. Ingresos y gastos del mes en curso
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    transactions.forEach(tx => {
      if (tx.status === 'paid' && isInFinancialCycle(tx.date, cycle) && !tx.transfer_group_id && !tx.billing_payment && tx.type !== 'transfer') {
        if (tx.type === 'income') {
          monthlyIncome += tx.amount || 0;
          incomeCount++;
        } else if (tx.type === 'expense') {
          monthlyExpense += tx.amount || 0;
          expenseCount++;
        }
      }
    });

    return {
      totalAvailableBalance,
      totalCreditDebt,
      totalCreditLimit,
      availableCreditLimit,
      netWorth,
      monthlyIncome,
      monthlyExpense,
      incomeCount,
      expenseCount,
      accountCount: activeAccounts.length,
      cardCount: activeCards.length,
    };
  }, [accounts, creditCards, transactions, cycle.start.getTime(), cycle.nextStart.getTime()]);

  return {
    ...summary,
    isLoading: loadingAccounts || loadingCards || loadingTx,
  };
}
