export const queryKeys = {
  wallet: {
    all: ['wallet'] as const,
    accounts: () => ['wallet', 'accounts'] as const,
    creditCards: () => ['wallet', 'creditCards'] as const,
    summary: () => ['wallet', 'summary'] as const,
    transactions: () => ['wallet', 'transactions'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
  },
  banks: {
    all: ['banks'] as const,
    templates: (bankId: string) => ['banks', bankId, 'templates'] as const,
  },
  budget: {
    all: ['budget'] as const,
    categories: () => ['budget', 'categories'] as const,
    budgets: () => ['budget', 'budgets'] as const,
  },
  agenda: {
    all: ['agenda'] as const,
    templates: () => ['agenda', 'templates'] as const,
    upcomingTemplates: (userId: string, startDate?: string, endDate?: string) =>
      ['agenda', 'templates', 'upcoming', userId, startDate ?? '', endDate ?? ''] as const,
  },
};
