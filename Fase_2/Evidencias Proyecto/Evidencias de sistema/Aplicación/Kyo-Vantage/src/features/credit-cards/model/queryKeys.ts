import { privateQueryKeys } from '@/features/app-shell/model/privateQueryKeys';

export const creditCardQueryKeys = {
  all: (userId: string) => [...privateQueryKeys.all(userId), 'credit-cards'] as const,
  cards: (userId: string) => [...creditCardQueryKeys.all(userId), 'cards'] as const,
  billingStatements: (userId: string) => [...creditCardQueryKeys.all(userId), 'billing-statements'] as const,
  billingStatementsByCard: (userId: string, cardId: string) => [
    ...creditCardQueryKeys.billingStatements(userId),
    cardId,
  ] as const,
};
