import { Suspense } from "react";
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from "@/shared/ui/PageHeader";
import { AccountDetailView } from "@/features/wallet/components/account/AccountDetailView";
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { useBanks } from '@/features/wallet/hooks/useBanks';

function AccountDetailContent() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const banksQuery = useBanks();
  const loading = accountsQuery.isLoading
    || transactionsQuery.isLoading
    || categoriesQuery.isLoading
    || banksQuery.isLoading;
  const account = (accountsQuery.data || []).find(item => item.id === id);
  const transactions = (transactionsQuery.data || []).filter(item => (
    item.account_id === id && item.status !== 'pending'
  ));
  const banks = banksQuery.data || [];
  const bank = banks.find(item => item.id === account?.bank_id);

  if (!id) return <div className="p-8 text-center text-danger">ID de cuenta no válido.</div>;
  if (loading) return <div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando cuenta...</div>;

  if (!account) {
    return (
      <div className="p-8 text-center text-danger font-bold text-lg mt-20">
        Error: Cuenta no encontrada. ID solicitado: “{id}”
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col w-full">
        <PageHeader title="Detalle de Cuenta" showBack />
      </div>

      <AccountDetailView
        account={account}
        transactions={transactions}
        categories={categoriesQuery.data || []}
        bank={bank}
        banks={banks}
      />
    </div>
  );
}

export default function AccountDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando...</div>}>
      <AccountDetailContent />
    </Suspense>
  );
}
