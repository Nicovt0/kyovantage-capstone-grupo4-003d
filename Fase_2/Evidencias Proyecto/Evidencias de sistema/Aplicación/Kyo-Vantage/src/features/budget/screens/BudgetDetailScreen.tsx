import { Suspense } from "react";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Coins } from "lucide-react";
import { ViewHeader } from "@/shared/ui/ViewHeader";
import { BudgetDetailView } from "@/features/budget/components/detail/BudgetDetailView";
import { useBudgets } from '@/features/budget/hooks/useBudgets';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';

function BudgetDetailContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');
  const budgetsQuery = useBudgets();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const accountsQuery = useAccounts();
  const loading = budgetsQuery.isLoading
    || transactionsQuery.isLoading
    || categoriesQuery.isLoading
    || accountsQuery.isLoading;
  const budget = (budgetsQuery.data || []).find(item => item.id === id);
  const transactions = (transactionsQuery.data || []).filter(item => item.status !== 'pending');

  if (!id) return <div className="p-8 text-center text-danger">ID de presupuesto no válido.</div>;
  if (loading) return <div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando presupuesto...</div>;

  if (!budget) {
    return (
      <div className="p-8 text-center text-danger font-bold text-lg mt-20">
        Error: Presupuesto no encontrado. ID solicitado: "{id}"
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 text-white animate-in fade-in duration-300 font-sans pb-24">
      <ViewHeader
        icon={<Coins className="w-6 h-6" />}
        title="Detalle de Presupuesto"
        onBack={() => navigate('/planning')}
      />

      <BudgetDetailView
        budget={budget}
        transactions={transactions}
        categories={categoriesQuery.data || []}
        accounts={accountsQuery.data || []}
      />
    </div>
  );
}

export default function BudgetDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando...</div>}>
      <BudgetDetailContent />
    </Suspense>
  );
}
