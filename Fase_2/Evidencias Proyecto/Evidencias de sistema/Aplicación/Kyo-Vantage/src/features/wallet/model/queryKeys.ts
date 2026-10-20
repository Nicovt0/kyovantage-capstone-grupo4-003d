import { privateQueryKeys } from '@/features/app-shell/model/privateQueryKeys';

export const walletQueryKeys = {
  all: (userId: string) => [...privateQueryKeys.all(userId), 'wallet'] as const,
  accounts: (userId: string) => [...walletQueryKeys.all(userId), 'accounts'] as const,
  banks: (userId: string) => [...walletQueryKeys.all(userId), 'banks'] as const,
  transactions: (userId: string) => [...walletQueryKeys.all(userId), 'transactions'] as const,
};
