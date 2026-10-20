import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from "lucide-react";
import { ViewHeader } from "@/shared/ui/ViewHeader";
import { TransactionsView } from "@/features/wallet/components/transactions/TransactionsView";
import { useTransactions } from "@/features/wallet/hooks/useTransactions";
import { useCategories } from "@/features/budget/hooks/useCategories";
import { useAccounts } from "@/features/wallet/hooks/useAccounts";

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { data: allTransactions, isLoading: loadingTx } = useTransactions();
  const { data: categories, isLoading: loadingCat } = useCategories();
  const { data: accounts, isLoading: loadingAcc } = useAccounts();

  const isLoading = loadingTx || loadingCat || loadingAcc;

  if (isLoading || !allTransactions || !categories || !accounts) {
    return <div className="p-8 text-center opacity-50 text-sm">Cargando...</div>;
  }

  const transactions = allTransactions.filter(t => t.status !== 'pending');

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 text-white animate-in fade-in duration-300 font-sans pb-24">
      <ViewHeader
        icon={<ArrowRightLeft className="w-6 h-6" />}
        title="Todos los Movimientos"
        onBack={() => navigate(-1)}
      />

      <TransactionsView
        transactions={transactions}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
