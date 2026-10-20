import { privateQueryKeys } from '@/features/app-shell/model/privateQueryKeys';

export const budgetQueryKeys = {
  all: (userId: string) => [...privateQueryKeys.all(userId), 'budget'] as const,
  budgets: (userId: string) => [...budgetQueryKeys.all(userId), 'budgets'] as const,
  categories: (userId: string) => [...budgetQueryKeys.all(userId), 'categories'] as const,
};
