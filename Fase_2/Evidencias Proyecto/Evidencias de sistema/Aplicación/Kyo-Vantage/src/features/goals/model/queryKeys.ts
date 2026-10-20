import { privateQueryKeys } from '@/features/app-shell/model/privateQueryKeys';

export const goalQueryKeys = {
  all: (userId: string) => [...privateQueryKeys.all(userId), 'goals'] as const,
};
