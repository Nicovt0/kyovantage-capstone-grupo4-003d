import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@/features/notifications/api/notificationRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { notificationQueryKeys } from '@/features/notifications/model/queryKeys';

export function useNotifications() {
  const { auth } = useAuth();

  return useQuery({
    queryKey: notificationQueryKeys.all(auth.id),
    queryFn: () => getNotifications(),
  });
}
