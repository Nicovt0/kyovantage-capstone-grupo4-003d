import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle } from '@/utils/financialCycle';
import { Budget, Category, Transaction } from "@/types";
import { useMemo } from "react";
import { BudgetCard } from "./BudgetCard";
import { BudgetBarChartSummary } from "./BudgetBarChartSummary";
import { Plus, Coins } from "lucide-react";
import { calculateBudgetStats } from "@/utils/budgetEngine";

interface BudgetOverviewProps {
  budgets: Budget[];
  transactions: Transaction[];
  categories: Category[];
  onAddBudget?: () => void;
}

export function BudgetOverview({ budgets, transactions, categories, onAddBudget }: BudgetOverviewProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const {referenceDate:currentDate}=useFinancialPeriod();

  const budgetsWithStats = useMemo(() => {
    const endOfMonth = getFinancialCycle(currentDate, cycleStartDay).end;

    const activeBudgetsForMonth = budgets.filter(b => {
      if (!b.start_date) return true;
      const startDate = new Date(b.start_date);
      return startDate <= endOfMonth;
    });

    return calculateBudgetStats(activeBudgetsForMonth, transactions, categories, currentDate, cycleStartDay);
  }, [budgets, transactions, categories, currentDate, cycleStartDay]);

  const totalBudget = useMemo(() => budgetsWithStats.reduce((sum, b) => sum + b.current_limit, 0), [budgetsWithStats]);
  const totalUsed = useMemo(() => budgetsWithStats.reduce((sum, b) => sum + b.spent, 0), [budgetsWithStats]);
  const totalAvailable = Math.max(0, totalBudget - totalUsed);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in">
      {/* Gráfico Centrado Libre */}
      <div className="w-full flex items-center justify-center">
        <BudgetBarChartSummary
          budgetsWithStats={budgetsWithStats}
          totalBudget={totalBudget}
          totalUsed={totalUsed}
          totalAvailable={totalAvailable}
        />
      </div>

      {/* Sección Inferior: Lista de Presupuestos */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground font-medium text-lg">
            <Coins size={20} className="text-[#6d28d9]" />
            <h2>Mis Presupuestos</h2>
          </div>
          <span className="text-sm font-medium text-[#5a5a72] dark:text-[#a0a0b8]">
            {budgetsWithStats.length}/5
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetsWithStats.map(budgetStat => (
            <BudgetCard
              key={budgetStat.id}
              budget={budgetStat}
              category={budgetStat.category}
              usedAmount={budgetStat.spent}
              currentLimit={budgetStat.current_limit}
              hideProgressBar={true}
            />
          ))}
          {budgetsWithStats.length < 5 && (
            <button
              type="button"
              onClick={onAddBudget}
              className="flex-1 min-h-[140px] bg-transparent border-2 border-dashed border-default-200 dark:border-border-subtle rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-default-50 dark:hover:bg-surface-card transition-colors cursor-pointer text-default-500 hover:text-foreground text-left"
            >
              <div className="w-12 h-12 rounded-full bg-default-100 dark:bg-surface-raised flex items-center justify-center text-default-400">
                <Plus size={24} />
              </div>
              <span className="font-semibold text-sm">Añadir Presupuesto</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
