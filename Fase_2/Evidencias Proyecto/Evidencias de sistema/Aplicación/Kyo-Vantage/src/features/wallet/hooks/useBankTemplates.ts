import { useQuery } from '@tanstack/react-query';
import { getAccountTemplates, getCreditCardTemplates } from '@/features/wallet/api/bankTemplateRepository';
import { queryKeys } from '@/lib/queryKeys';

export function useAllBankTemplates() {
  const accountTemplatesQuery = useQuery({
    queryKey: [...queryKeys.banks.all, 'templates', 'accounts', 'all'],
    queryFn: () => getAccountTemplates(),
  });

  const cardTemplatesQuery = useQuery({
    queryKey: [...queryKeys.banks.all, 'templates', 'credit-cards', 'all'],
    queryFn: () => getCreditCardTemplates(),
  });

  return {
    accountTemplates: accountTemplatesQuery.data || [],
    cardTemplates: cardTemplatesQuery.data || [],
    isLoading: accountTemplatesQuery.isLoading || cardTemplatesQuery.isLoading,
  };
}

export function useBankAccountTemplates(bankId: string | null) {
  return useQuery({
    queryKey: queryKeys.banks.templates(bankId || 'all'),
    queryFn: async () => {
      const allTemplates = await getAccountTemplates();
      if (!bankId) return allTemplates;
      return allTemplates.filter(t => t.bank_id === bankId);
    },
    enabled: Boolean(bankId),
  });
}

export function useBankCreditCardTemplates(bankId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.banks.all, bankId || 'all', 'card-templates'],
    queryFn: async () => {
      const allTemplates = await getCreditCardTemplates();
      if (!bankId) return allTemplates;
      return allTemplates.filter(t => t.bank_id === bankId);
    },
    enabled: Boolean(bankId),
  });
}
