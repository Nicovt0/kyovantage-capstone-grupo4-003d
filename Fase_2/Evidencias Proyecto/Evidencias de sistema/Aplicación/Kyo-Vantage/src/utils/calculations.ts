import { financialCycleForMonth, isInFinancialCycle } from './financialCycle.ts';
import { Account, Transaction, Budget, CreditCard, Goal } from "@/types";

/**
 * Calcula el balance total líquido sumando todas las cuentas
 * @param accounts Lista de cuentas
 * @param includeHidden Si es true, suma también las cuentas marcadas como no incluidas en el total
 */
export const calculateTotalBalance = (accounts: Account[], includeHidden: boolean = false): number => {
  return accounts.reduce((total, account) => {
    if (!includeHidden && !account.include_in_total) return total;
    return total + account.balance;
  }, 0);
};

/**
 * Calcula el total de ingresos o gastos en un mes específico
 */
export const calculateMonthlyCashflow = (
  transactions: Transaction[], 
  type: 'income' | 'expense', 
  month: number, 
  year: number,
  cycleStartDay = 1
): number => {
  return transactions
    .filter(t => t.type === type)
    .filter(t => {
      const date = new Date(t.date);
      return isInFinancialCycle(t.date, financialCycleForMonth(year, month, cycleStartDay));
    })
    // Para transacciones que son en cuotas y se pagan en este mes, 
    // asumimos que 'amount' es el valor de UNA cuota por lo que se suma directo.
    .reduce((total, t) => total + t.amount, 0);
};

/**
 * Calcula cuánto se ha gastado de un presupuesto en el mes actual
 */
export const calculateBudgetProgress = (
  budget: Budget, 
  transactions: Transaction[], 
  month: number, 
  year: number,
  cycleStartDay = 1
) => {
  const spent = transactions
    .filter(t => t.type === 'expense' && t.category_id === budget.category_id)
    .filter(t => {
      const date = new Date(t.date);
      return isInFinancialCycle(t.date, financialCycleForMonth(year, month, cycleStartDay));
    })
    .reduce((total, t) => total + t.amount, 0);

  const percentage = Math.min((spent / budget.limit_amount) * 100, 100);

  return {
    spent,
    limit: budget.limit_amount,
    percentage: Number(percentage.toFixed(1))
  };
};

/**
 * Calcula la deuda total asociada a una tarjeta de crédito en el mes actual.
 * (Suma las cuotas y gastos que caen en este ciclo).
 */
export const calculateCreditCardDebt = (
  credit_card_id: string, 
  transactions: Transaction[],
  month: number,
  year: number
): number => {
  return transactions
    .filter(t => t.credit_card_id === credit_card_id && t.type === 'expense')
    .filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === month && date.getFullYear() === year;
    })
    .reduce((total, t) => total + t.amount, 0);
};

/**
 * Calcula el progreso de una meta de ahorro
 */
export const calculateGoalProgress = (goal: Goal) => {
  const percentage = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  return {
    current: goal.current_amount,
    target: goal.target_amount,
    percentage: Number(percentage.toFixed(1))
  };
};
