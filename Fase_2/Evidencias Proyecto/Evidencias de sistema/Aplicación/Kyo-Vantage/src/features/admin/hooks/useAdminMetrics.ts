import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPlatformStats,
  getRecentActivityLogs,
  PlatformStats,
  ActivityLog,
} from '../api/adminMetricsRepository';

export const ADMIN_METRICS_QUERY_KEYS = {
  stats: ['admin', 'metrics', 'stats'] as const,
  activityLogs: ['admin', 'metrics', 'activityLogs'] as const,
};

/**
 * Hook to retrieve platform aggregate metrics with controlled staleTime (60s).
 */
export function usePlatformStats() {
  return useQuery<PlatformStats, Error>({
    queryKey: ADMIN_METRICS_QUERY_KEYS.stats,
    queryFn: getPlatformStats,
    staleTime: 1000 * 60, // 60 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes in memory
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Hook to retrieve recent activity audit logs with controlled staleTime (60s).
 */
export function useRecentActivityLogs() {
  return useQuery<ActivityLog[], Error>({
    queryKey: ADMIN_METRICS_QUERY_KEYS.activityLogs,
    queryFn: getRecentActivityLogs,
    staleTime: 1000 * 60, // 60 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes in memory
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Combined hook for full metrics and monitoring dashboard controls.
 */
export function useAdminMetricsDashboard() {
  const queryClient = useQueryClient();
  const statsQuery = usePlatformStats();
  const activityLogsQuery = useRecentActivityLogs();

  const refetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_QUERY_KEYS.stats }),
      queryClient.invalidateQueries({ queryKey: ADMIN_METRICS_QUERY_KEYS.activityLogs }),
    ]);
  };

  const isRefreshing = statsQuery.isFetching || activityLogsQuery.isFetching;

  return {
    statsQuery,
    activityLogsQuery,
    refetchAll,
    isRefreshing,
  };
}
