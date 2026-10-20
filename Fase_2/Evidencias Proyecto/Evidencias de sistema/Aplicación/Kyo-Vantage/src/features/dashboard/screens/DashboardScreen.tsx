import { FinancialPeriodNavigator } from '@/shared/ui/FinancialPeriodNavigator';
import { useEffect } from "react";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { DashboardOverview } from "@/features/dashboard/components/DashboardOverview";
import { initializeBackgroundGenerators } from "@/features/app-shell/lib/initializeBackgroundTasks";
import { useAuth } from '@/features/auth/components/AuthProvider';

export default function V3Dashboard() {
  const { data, isLoading, isError, refetchAll } = useDashboardData();
  const { auth } = useAuth();

  useEffect(() => {
    void initializeBackgroundGenerators();
  }, []);

  if(isError)return <div role="alert" className="p-8 text-center"><p>No se pudo cargar el resumen financiero.</p><button type="button" onClick={refetchAll} className="mt-3 rounded-xl bg-brand-primary px-4 py-2 text-white">Reintentar</button></div>;
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-full w-full opacity-50 p-10 text-sm">Cargando dashboard...</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <FinancialPeriodNavigator/>
      <DashboardOverview
        userName={auth.displayName || auth.email.split('@')[0] || 'Usuario'}
        accounts={data.accounts}
        creditCards={data.creditCards}
        transactions={data.transactions}
        goals={data.goals}
        budgets={data.budgets}
        categories={data.categories}
        banks={data.banks}
        billingStatements={data.billingStatements}
      />
    </div>
  );
}
