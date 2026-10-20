import { useBudgets } from "@/features/budget/hooks/useBudgets";
import { useTransactions } from "@/features/wallet/hooks/useTransactions";
import { useCategories } from "@/features/budget/hooks/useCategories";
import { BudgetOverview } from "@/features/budget/components/BudgetOverview";
import { PageHeader } from "@/shared/ui/PageHeader";

export default function BudgetRootPage() {
  const { data: budgets, isLoading: loadingB } = useBudgets();
  const { data: allTransactions, isLoading: loadingTx } = useTransactions();
  const { data: categories, isLoading: loadingC } = useCategories();

  const isLoading = loadingB || loadingTx || loadingC;

  if (isLoading || !budgets || !allTransactions || !categories) {
    return <div className="flex items-center justify-center h-full w-full opacity-50 p-10 text-sm">Cargando presupuestos...</div>;
  }

  const transactions = allTransactions.filter(t => t.status !== 'pending');

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Presupuestos"
          description="Administra tus límites de gasto mensuales"
        />
      </div>

      <BudgetOverview
        budgets={budgets}
        transactions={transactions}
        categories={categories}
      />
    </div>
  );
}
