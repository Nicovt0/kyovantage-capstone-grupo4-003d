import { getFinancialCycle } from '@/utils/financialCycle';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { useMemo, useCallback } from 'react';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useAgendaEvents } from '@/features/agenda/hooks/useAgendaEvents';
import {
  calculateCommittedExpenses,
  calculateNetAvailability,
  LiquidityStatus,
} from '../services/availabilityCalculator';

export interface AvailableLiquidityHookResult {
  totalBalance: number;
  committedTotal: number;
  netAvailable: number;
  status: LiquidityStatus;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Reactive hook providing liquidity projection and availability buffer in memory.
 * Consumes TanStack Query cached data from accounts and agenda events without extra Supabase calls.
 * [SP2-09]: Re-render audit - returns memoized stable references and selectors.
 */
export function useAvailableLiquidity(referenceDate?: Date): AvailableLiquidityHookResult {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const {
    data: accounts = [],
    isLoading: isAccountsLoading,
    isError: isAccountsError,
    refetch: refetchAccounts,
  } = useAccounts();

  const {
    events = [],
    isLoading: isEventsLoading,
    isError: isEventsError,
    refetch: refetchEvents,
  } = useAgendaEvents(referenceDate ? { month: getFinancialCycle(referenceDate, cycleStartDay).start.getMonth() + 1, year: getFinancialCycle(referenceDate, cycleStartDay).start.getFullYear() } : undefined);

  // Stable target date based on millisecond timestamp
  const refTime = referenceDate ? referenceDate.getTime() : null;
  const targetDate = useMemo(() => (refTime !== null ? new Date(refTime) : new Date()), [refTime]);

  // Compute liquidity metrics in memory
  const metrics = useMemo(() => {
    // Sum total balance from active, unarchived accounts configured to include in total
    const balanceSum = accounts.reduce((acc, account) => {
      if (account.is_archived || account.is_active === false || account.include_in_total === false) {
        return acc;
      }
      const val = Number(account.balance || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const committed = calculateCommittedExpenses(events, targetDate, cycleStartDay);
    const availability = calculateNetAvailability(balanceSum, committed);

    return {
      totalBalance: Math.round(balanceSum * 100) / 100,
      committedTotal: availability.committedTotal,
      netAvailable: availability.netAvailable,
      status: availability.status,
    };
  }, [accounts, events, targetDate, cycleStartDay]);

  const refetch = useCallback(() => {
    void refetchAccounts();
    void refetchEvents();
  }, [refetchAccounts, refetchEvents]);

  const isLoading = isAccountsLoading || isEventsLoading;
  const isError = isAccountsError || isEventsError;

  return useMemo(
    () => ({
      totalBalance: metrics.totalBalance,
      committedTotal: metrics.committedTotal,
      netAvailable: metrics.netAvailable,
      status: metrics.status,
      isLoading,
      isError,
      refetch,
    }),
    [
      metrics.totalBalance,
      metrics.committedTotal,
      metrics.netAvailable,
      metrics.status,
      isLoading,
      isError,
      refetch,
    ]
  );
}
