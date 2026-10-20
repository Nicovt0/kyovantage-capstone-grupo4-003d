import { getFinancialCycle } from './financialCycle.ts';
import type { Budget, Transaction } from "@/types";

export function parseBudgetTransactionDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
}

export interface BudgetStats extends Budget {
  category?: any;
  spent: number;
  pct: number;
  remaining: number;
  isOver: boolean;
  isNear: boolean;
  status: 'active' | 'expired';
  current_limit: number; // Limit including rollover
  growth_rate?: number; // Growth vs previous period
  isTrendingUp?: boolean; // True if growth >= 10%
}

export function getBudgetPeriodDates(period: 'weekly' | 'monthly' | 'annual', date: Date = new Date(), cycleStartDay = 1) {
  const start = new Date(date);
  const end = new Date(date);

  if (period === 'weekly') {
    const day = start.getDay();
    const diffToMonday = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diffToMonday);
    start.setHours(0, 0, 0, 0);

    end.setFullYear(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    const cycle = getFinancialCycle(date, cycleStartDay);
    return { start: cycle.start, end: cycle.end };
  } else if (period === 'annual') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export function calculateBudgetStats(
  budgets: Budget[],
  transactions: Transaction[],
  categories: any[],
  targetDate: Date = new Date(),
  cycleStartDay = 1
): BudgetStats[] {
  return budgets.map(b => {
    const category = categories.find(c => c.id === b.category_id);
    const { start: currentStart, end: currentEnd } = getBudgetPeriodDates(b.period, targetDate, cycleStartDay);
    
    // Check if expired
    let status: 'active' | 'expired' = 'active';
    if (!b.recurrent && b.start_date) {
      const budgetStart = parseBudgetTransactionDate(b.start_date);
      const { end: budgetEnd } = getBudgetPeriodDates(b.period, budgetStart, cycleStartDay);
      if (targetDate > budgetEnd) {
        status = 'expired';
      }
    }

    // Filter transactions for this category
    const catTransactions = transactions.filter(t => t.category_id === b.category_id && t.type === 'expense');

    // Current period spent
    const spent = catTransactions
      .filter(t => {
        const d = parseBudgetTransactionDate(t.date);
        return d >= currentStart && d <= currentEnd;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Rollover calculation
    let rolloverAmount = 0;
    if (b.rollover && b.start_date) {
      const budgetStart = parseBudgetTransactionDate(b.start_date);
      const { start: absoluteStart } = getBudgetPeriodDates(b.period, budgetStart, cycleStartDay);
      
      // We only consider past periods that ended before the current period started
      if (currentStart > absoluteStart) {
        let currentIterStart = new Date(absoluteStart);
        let currentIterEnd = new Date(absoluteStart);
        
        while (currentIterStart < currentStart) {
          const { end: iterEnd } = getBudgetPeriodDates(b.period, currentIterStart, cycleStartDay);
          currentIterEnd = new Date(iterEnd);
          
          if (currentIterEnd >= currentStart) break;

          const spentInIter = catTransactions
            .filter(t => {
              const d = parseBudgetTransactionDate(t.date);
              return d >= currentIterStart && d <= currentIterEnd;
            })
            .reduce((sum, t) => sum + t.amount, 0);
            
          // If exceeded in any past iteration, rollover rests to 0 (compasivo rule)
          if (spentInIter > b.limit_amount) {
            rolloverAmount = 0;
          } else {
            rolloverAmount += (b.limit_amount - spentInIter);
          }

          // Advance to next period
          currentIterStart = new Date(currentIterEnd);
          currentIterStart.setDate(currentIterStart.getDate() + 1);
          currentIterStart.setHours(0, 0, 0, 0);
        }
      }
    }

    const current_limit = b.limit_amount + rolloverAmount;
    const pct = current_limit > 0 ? Math.round((spent / current_limit) * 100) : 0;
    const remaining = Math.max(0, current_limit - spent);
    const isOver = spent > current_limit;
    const isNear = pct >= b.alert_threshold && !isOver;

    // Trend calculation (growth vs previous period)
    let previousSpent = 0;
    if (b.start_date) {
      const budgetStart = parseBudgetTransactionDate(b.start_date);
      const { start: absoluteStart } = getBudgetPeriodDates(b.period, budgetStart, cycleStartDay);
      if (currentStart > absoluteStart) {
        // Calculate previous period
        const prevStart = new Date(currentStart);
        prevStart.setDate(prevStart.getDate() - 1);
        const { start: prevPeriodStart, end: prevPeriodEnd } = getBudgetPeriodDates(b.period, prevStart, cycleStartDay);

        previousSpent = catTransactions
          .filter(t => {
            const d = parseBudgetTransactionDate(t.date);
            return d >= prevPeriodStart && d <= prevPeriodEnd;
          })
          .reduce((sum, t) => sum + t.amount, 0);
      }
    }

    let growth_rate = 0;
    if (previousSpent > 0) {
      growth_rate = ((spent - previousSpent) / previousSpent) * 100;
    } else if (spent > 0) {
      growth_rate = 100; // If prev was 0 and now has spent, it grew
    }
    const isTrendingUp = growth_rate >= 10;

    return {
      ...b,
      category,
      spent,
      pct,
      remaining,
      isOver,
      isNear,
      status,
      current_limit,
      growth_rate,
      isTrendingUp
    };
  });
}
