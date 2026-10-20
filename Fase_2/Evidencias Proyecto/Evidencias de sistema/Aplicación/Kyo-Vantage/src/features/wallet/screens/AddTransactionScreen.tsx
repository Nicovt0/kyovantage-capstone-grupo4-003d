import { PageHeader } from "@/shared/ui/PageHeader";
import { TransactionEntryForm } from '@/features/wallet/components/transaction/TransactionEntryForm';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCategories } from '@/features/budget/hooks/useCategories';

export default function AddTransactionPage() {
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const isLoading = accountsQuery.isLoading
    || categoriesQuery.isLoading;

  if (isLoading) return <div className="p-8 text-center opacity-50 text-sm">Cargando...</div>;
  if (accountsQuery.isError || categoriesQuery.isError) return <p role="alert">No se pudieron cargar las cuentas o categorías. Vuelve a intentarlo.</p>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Añadir Transacción"
          showBack
        />
      </div>

      <div className="px-2 md:px-0">
        <TransactionEntryForm
          accounts={accountsQuery.data || []}
          categories={categoriesQuery.data || []}
        />
      </div>
    </div>
  );
}
