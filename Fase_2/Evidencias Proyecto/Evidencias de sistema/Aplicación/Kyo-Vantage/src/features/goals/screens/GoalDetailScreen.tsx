import { Suspense } from "react";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Flag } from "lucide-react";
import { ViewHeader } from "@/shared/ui/ViewHeader";
import { GoalDetailView } from "@/features/goals/components/detail/GoalDetailView";
import { useGoals } from '@/features/goals/hooks/useGoals';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';

function GoalDetailContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get('id');
  const goalsQuery = useGoals();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const accountsQuery = useAccounts();
  const loading = goalsQuery.isLoading
    || transactionsQuery.isLoading
    || categoriesQuery.isLoading
    || accountsQuery.isLoading;
  const goal = (goalsQuery.data || []).find(item => item.id === id);
  const goalTransactions = (transactionsQuery.data || []).filter(item => (
    item.goal_id === id && item.status !== 'pending'
  ));

  if (!id) return <div className="p-8 text-center text-danger">ID de meta no válido.</div>;
  if (goalsQuery.isError) return <div role="alert" className="p-8 text-center space-y-3">
    <p>{goalsQuery.error.message}</p>
    <button type="button" onClick={() => void goalsQuery.refetch()} disabled={goalsQuery.isFetching} className="rounded-xl bg-purple-600 px-4 py-2 text-white disabled:opacity-50">Reintentar cargar metas</button>
  </div>;
  if (loading) return <div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando meta...</div>;

  if (!goal) {
    return <div className="p-8 text-center text-danger font-bold text-lg mt-20">Meta no encontrada.</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 text-white animate-in fade-in duration-300 font-sans pb-24">
      <ViewHeader
        icon={<Flag className="w-6 h-6" />}
        title="Detalle de Meta"
        onBack={() => navigate('/planning')}
      />
      <GoalDetailView
        goal={goal}
        transactions={goalTransactions}
        categories={categoriesQuery.data || []}
        accounts={accountsQuery.data || []}
      />
    </div>
  );
}

export default function GoalDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando...</div>}>
      <GoalDetailContent />
    </Suspense>
  );
}
