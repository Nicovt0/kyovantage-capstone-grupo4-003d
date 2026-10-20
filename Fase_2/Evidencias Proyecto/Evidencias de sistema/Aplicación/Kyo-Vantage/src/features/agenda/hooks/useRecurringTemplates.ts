import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUpcomingTemplates,
  createRecurringTemplate,
  updateRecurringTemplateStatus,
  deleteRecurringTemplate,
  updateRecurringTemplate,
} from '@/modules/agenda/services/eventRepository';
import { CreateRecurringTemplateDTO, UpdateRecurringTemplateDTO } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Hook to fetch upcoming recurring commitments for the given user and date range.
 */
export function useUpcomingTemplates(userId: string | undefined, startDate: Date, endDate: Date) {
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: queryKeys.agenda.upcomingTemplates(userId || '', startStr, endStr),
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return getUpcomingTemplates(userId, startDate, endDate);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Hook to create a recurring template with automatic cache invalidation.
 */
export function useCreateRecurringTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecurringTemplateDTO) => createRecurringTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });
}

/**
 * Hook to update a recurring template's status ('pending' | 'paid' | 'overdue').
 */
export function useUpdateRecurringTemplateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'paid' | 'overdue' }) =>
      updateRecurringTemplateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });
}

/**
 * Hook to delete a recurring template with automatic cache invalidation.
 */
export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRecurringTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });
}

/**
 * Hook to update arbitrary template fields with cache invalidation.
 */
export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRecurringTemplateDTO }) =>
      updateRecurringTemplate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agenda.all });
    },
  });
}

export { useMarkEventAsPaid } from './useMarkEventAsPaid';

