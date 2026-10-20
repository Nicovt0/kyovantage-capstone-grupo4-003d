import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { getFinancialSettings, saveFinancialSettings, DEFAULT_FINANCIAL_SETTINGS } from '../api/financialSettingsRepository';
export const financialSettingsKey = (id: string) => ['private', id, 'financial-settings'] as const;
export function useFinancialSettings() {
  const { auth } = useAuth();
  const query = useQuery({ queryKey: financialSettingsKey(auth.id), queryFn: getFinancialSettings, enabled: Boolean(auth.id), staleTime: 300000 });
  return { ...query, settings: query.data ?? DEFAULT_FINANCIAL_SETTINGS };
}
export function useSaveFinancialSettings() {
  const { auth } = useAuth();
  const client = useQueryClient();
  return useMutation({ mutationFn: saveFinancialSettings, onSuccess: async settings => {
    client.setQueryData(financialSettingsKey(auth.id), settings);
    await client.invalidateQueries({ predicate: query => {
      const key = query.queryKey;
      if (key[0] === 'private' && key[1] === auth.id) return key[2] !== 'financial-settings';
      return ['agenda', 'budget', 'wallet', 'dashboard', 'availability'].includes(String(key[0]));
    } });
  } });
}
