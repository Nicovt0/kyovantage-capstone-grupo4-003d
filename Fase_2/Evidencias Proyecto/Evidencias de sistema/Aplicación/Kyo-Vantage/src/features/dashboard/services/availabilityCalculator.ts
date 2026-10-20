import { getFinancialCycle, isInFinancialCycle } from '../../../utils/financialCycle.ts';
export type LiquidityStatus = 'healthy' | 'warning' | 'deficit';

export interface RecurringTemplateLike {
  id?: string;
  name?: string;
  title?: string;
  amount?: number;
  expected_amount?: number;
  type?: 'income' | 'expense' | string;
  status?: 'pending' | 'paid' | 'overdue' | string;
  frequency?: 'once' | 'monthly' | 'yearly' | string;
  due_date?: string | null;
  next_due_date?: string | null;
  payment_day?: number | null;
  day_of_month?: number | null;
  is_active?: boolean;
}

export interface NetAvailabilityResult {
  netAvailable: number;
  committedTotal: number;
  status: LiquidityStatus;
}

/**
 * Sums pending committed expenses for the reference month.
 * Omits paid, cancelled or non-expense templates to avoid double accounting.
 */
export function calculateCommittedExpenses(
  templates: RecurringTemplateLike[] = [],
  referenceDate: Date = new Date(),
  cycleStartDay = 1
): number {
  if (!Array.isArray(templates) || templates.length === 0) {
    return 0;
  }

  const cycle = getFinancialCycle(referenceDate, cycleStartDay);
  const targetMonth = referenceDate.getMonth(); // 0-11

  const total = templates.reduce((sum, template) => {
    // 1. Must be active (defaults to true if undefined)
    if (template.is_active === false) return sum;

    // 2. Must be an expense type (defaults to 'expense' if undefined)
    const type = template.type || 'expense';
    if (type !== 'expense') return sum;

    // 3. Must be pending status (omit 'paid', 'cancelled', etc.)
    const status = template.status || 'pending';
    if (status !== 'pending') return sum;

    // 4. Date filtering logic
    const dueDateStr = template.due_date || template.next_due_date;
    if (dueDateStr) {
      const dueDate = new Date(dueDateStr);
      if (!isNaN(dueDate.getTime())) {
        // If template has explicit due_date, verify month and year
        if (!isInFinancialCycle(dueDateStr, cycle)) {
          return sum;
        }
      }
    } else if (template.frequency === 'once') {
      // If frequency is 'once' without due_date, omit
      return sum;
    } else if (template.frequency === 'yearly') {
      // For yearly, if no explicit due_date, check payment_day or day_of_month
      if (template.due_date) {
        const d = new Date(template.due_date);
        if (d.getMonth() !== targetMonth) return sum;
      }
    }

    const amount = Number(template.expected_amount ?? template.amount ?? 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  return Math.max(0, Math.round(total * 100) / 100);
}

/**
 * Calculates net available liquidity and semaphoric status based on total balance and committed amount.
 * - 'deficit': netAvailable < 0
 * - 'warning': netAvailable >= 0 and netAvailable / totalBalance < 0.15 (less than 15% buffer remaining)
 * - 'healthy': netAvailable >= 0 and netAvailable / totalBalance >= 0.15
 */
export function calculateNetAvailability(
  totalBalance: number,
  committedAmount: number
): NetAvailabilityResult {
  const balance = isNaN(totalBalance) ? 0 : totalBalance;
  const committed = isNaN(committedAmount) ? 0 : Math.max(0, committedAmount);
  const netAvailable = balance - committed;

  let status: LiquidityStatus = 'healthy';

  if (netAvailable < 0) {
    status = 'deficit';
  } else if (balance <= 0) {
    status = netAvailable === 0 && committed === 0 ? 'healthy' : 'warning';
  } else {
    const ratio = netAvailable / balance;
    if (ratio < 0.15) {
      status = 'warning';
    } else {
      status = 'healthy';
    }
  }

  return {
    netAvailable: Math.round(netAvailable * 100) / 100,
    committedTotal: Math.round(committed * 100) / 100,
    status,
  };
}
