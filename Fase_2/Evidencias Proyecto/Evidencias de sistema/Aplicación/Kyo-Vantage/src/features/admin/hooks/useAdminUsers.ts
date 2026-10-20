import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllUsersAdmin,
  updateUserRoleAdmin,
  toggleUserActiveStatusAdmin,
  GetAllUsersAdminParams,
  UserRole,
} from '@/features/admin/api/adminUsersRepository';

export const ADMIN_USERS_QUERY_KEYS = {
  all: ['admin', 'users'] as const,
  list: (params: GetAllUsersAdminParams) => ['admin', 'users', 'list', params] as const,
};

export function useAdminUsers(params: GetAllUsersAdminParams = {}) {
  return useQuery({
    queryKey: ADMIN_USERS_QUERY_KEYS.list(params),
    queryFn: () => getAllUsersAdmin(params),
    staleTime: 1000 * 30, // 30 seconds fresh
    gcTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      newRole,
      isAdmin,
    }: {
      userId: string;
      newRole: UserRole;
      isAdmin: boolean;
    }) => updateUserRoleAdmin(userId, newRole, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEYS.all });
    },
  });
}

export function useToggleUserActiveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => toggleUserActiveStatusAdmin(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEYS.all });
    },
  });
}
