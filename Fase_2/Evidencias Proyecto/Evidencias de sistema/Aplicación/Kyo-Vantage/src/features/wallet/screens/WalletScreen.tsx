import { useAccounts } from "@/features/wallet/hooks/useAccounts";
import { useTransactions } from "@/features/wallet/hooks/useTransactions";
import { useCategories } from "@/features/budget/hooks/useCategories";
import { useBanks } from "@/features/wallet/hooks/useBanks";
import { WalletOverview } from "@/features/wallet/components/WalletOverview";
import { PageHeader } from "@/shared/ui/PageHeader";

export default function V3Wallet() {
  const { data: accounts, isLoading: loadingAcc } = useAccounts();
  const { data: allTransactions, isLoading: loadingTx } = useTransactions();
  const { data: categories, isLoading: loadingCat } = useCategories();
  const { data: banks, isLoading: loadingBanks } = useBanks();

  const isLoading = loadingAcc || loadingTx || loadingCat || loadingBanks;

  if (isLoading || !accounts || !allTransactions || !categories || !banks) {
    return <div className="flex items-center justify-center h-full w-full opacity-50 p-10 text-sm">Cargando billetera...</div>;
  }

  const transactions = allTransactions.filter(t => t.status !== 'pending');

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Billetera"
          description="Gestiona tu patrimonio, cuentas y analiza tus gastos."
        />
      </div>

      <WalletOverview
        accounts={accounts}
        transactions={transactions}
        categories={categories}
        banks={banks}
      />
    </div>
  );
}
