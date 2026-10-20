import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { periodTransactions } from '@/features/app-shell/model/financialPeriod';
import { parseFinancialDate } from '@/utils/financialCycle';
import { FinancialPeriodNavigator } from '@/shared/ui/FinancialPeriodNavigator';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BudgetOverview } from '@/features/budget/components/BudgetOverview';
import { useBudgets } from '@/features/budget/hooks/useBudgets';
import { useCategories } from '@/features/budget/hooks/useCategories';
import BudgetDetailScreen from '@/features/budget/screens/BudgetDetailScreen';
import { GoalsDashboardView } from '@/features/goals/components/dashboard/GoalsDashboardView';
import GoalDetailScreen from '@/features/goals/screens/GoalDetailScreen';
import { useGoals } from '@/features/goals/hooks/useGoals';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { ViewHeader } from '@/shared/ui/ViewHeader';
import { Flag } from 'lucide-react';
import { BudgetModal } from '@/features/budget/components/BudgetModal';
import { GoalModal } from '@/features/goals/components/GoalModal';

function PlanningOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const {cycle}=useFinancialPeriod();
  const budgetsQuery = useBudgets();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const goalsQuery = useGoals();

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'create-budget') {
      setIsBudgetModalOpen(true);
    } else if (viewParam === 'create-goal') {
      setIsGoalModalOpen(true);
    }
  }, [searchParams]);

  const handleCloseBudgetModal = () => {
    setIsBudgetModalOpen(false);
    if (searchParams.get('view') === 'create-budget') {
      setSearchParams({});
    }
  };

  const handleCloseGoalModal = () => {
    setIsGoalModalOpen(false);
    if (searchParams.get('view') === 'create-goal') {
      setSearchParams({});
    }
  };

  const failedQuery=[goalsQuery,budgetsQuery,transactionsQuery,categoriesQuery].find(query=>query.isError);
  if(failedQuery) return <div role="alert" className="p-8 text-center"><p>{failedQuery.error?.message || 'No se pudo cargar la planificación.'}</p><button type="button" onClick={()=>void failedQuery.refetch()} className="mt-3 rounded-xl bg-brand-primary px-4 py-2 text-white">Reintentar</button></div>;

  if (
    budgetsQuery.isLoading
    || transactionsQuery.isLoading
    || categoriesQuery.isLoading
    || goalsQuery.isLoading
    || !budgetsQuery.data
    || !transactionsQuery.data
    || !categoriesQuery.data
    || !goalsQuery.data
  ) {
    return <div className="flex items-center justify-center p-10 text-sm opacity-50">Cargando planificación...</div>;
  }

  const visibleGoals=goalsQuery.data.filter(goal=>parseFinancialDate(goal.start_date)<cycle.nextStart);
  const contributions=periodTransactions(transactionsQuery.data,cycle).filter(tx=>tx.goal_id && tx.type==='expense').reduce((sum,tx)=>sum+tx.amount,0);
  const transactions = transactionsQuery.data.filter(transaction => transaction.status !== 'pending');

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 text-foreground animate-in fade-in duration-300 font-sans pb-24">
      <ViewHeader
        icon={<Flag className="w-6 h-6" />}
        title="Planificación"
        description="Administra tus presupuestos y metas de ahorro"
      />

      <FinancialPeriodNavigator/>
      <BudgetOverview
        budgets={budgetsQuery.data}
        transactions={transactions}
        categories={categoriesQuery.data}
        onAddBudget={() => setIsBudgetModalOpen(true)}
      />

      <p className="text-sm text-on-surface-card-secondary">Aportes a metas en este período: <strong className="text-foreground">${contributions.toLocaleString('es-CL')}</strong></p>
      <GoalsDashboardView
        goals={visibleGoals}
        onAddGoal={() => setIsGoalModalOpen(true)}
      />

      {/* Modales Flotantes */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={handleCloseBudgetModal}
        onSaved={() => {
          budgetsQuery.refetch();
        }}
        categories={categoriesQuery.data}
      />

      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={handleCloseGoalModal}
        onSaved={() => {
          goalsQuery.refetch();
        }}
      />
    </div>
  );
}

export function PlanningView() {
  const [searchParams] = useSearchParams();

  switch (searchParams.get('view')) {
    case 'budget-detail':
      return <BudgetDetailScreen />;
    case 'goal-detail':
      return <GoalDetailScreen />;
    default:
      return <PlanningOverview />;
  }
}
