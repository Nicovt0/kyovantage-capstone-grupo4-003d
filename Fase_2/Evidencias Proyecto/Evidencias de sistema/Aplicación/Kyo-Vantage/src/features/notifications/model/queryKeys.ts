import { privateQueryKeys } from '@/features/app-shell/model/privateQueryKeys';

export const notificationQueryKeys = {
  all: (userId: string) => [...privateQueryKeys.all(userId), 'notifications'] as const,
};
