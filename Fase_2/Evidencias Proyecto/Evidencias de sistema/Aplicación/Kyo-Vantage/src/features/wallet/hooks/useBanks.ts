import { useQuery } from '@tanstack/react-query';
import { getBanks } from '@/features/wallet/api/bankRepository';
import { queryKeys } from '@/lib/queryKeys';

export function useBanks() {
  return useQuery({
    queryKey: queryKeys.banks.all,
    queryFn: () => getBanks(),
  });
}
