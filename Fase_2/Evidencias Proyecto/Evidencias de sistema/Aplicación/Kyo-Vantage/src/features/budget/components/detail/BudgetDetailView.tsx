import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { FinancialPeriodNavigator } from '@/shared/ui/FinancialPeriodNavigator';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, financialCycleLabel } from '@/utils/financialCycle';
import { Budget, Transaction, Category, Account } from "@/types";
import { useState, useMemo } from "react";
import { Button, Spinner } from "@heroui/react";
import { ChevronLeft, ChevronRight, Edit2, ShoppingCart, Trash2, ArrowRightLeft, BarChart3, Target, Wallet } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { calculateBudgetStats, getBudgetPeriodDates, parseBudgetTransactionDate } from "@/utils/budgetEngine";
import { TransactionDetailModal } from "@/features/wallet/components/transactions/TransactionDetailModal";
import { BudgetTrendChart } from "@/features/budget/components/detail/BudgetTrendChart";
import { BudgetEditModal } from "./BudgetEditModal";
import { BudgetDeleteModal } from "./BudgetDeleteModal";
import { useNavigate } from 'react-router-dom';
import { getBudgetTrafficLight } from "@/utils/budgetTrafficLight";

interface BudgetDetailViewProps {
  budget: Budget;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
}

export function BudgetDetailView({ budget, transactions, categories, accounts }: BudgetDetailViewProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const navigate = useNavigate();
  const {referenceDate:currentDate}=useFinancialPeriod();
  const [chartRange, setChartRange] = useState<'1W' | '1M' | '1Y'>('1M');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Computar estadísticas del presupuesto para el mes actual
  const budgetStat = useMemo(() => {
    const stats = calculateBudgetStats([budget], transactions, categories, currentDate, cycleStartDay);
    return stats[0];
  }, [budget, transactions, categories, currentDate, cycleStartDay]);

  const category = budgetStat.category;
  const color = '#a0a0b8';
  const IconComponent = category ? ((LucideIcons as any)[category.icon_name] || ShoppingCart) : ShoppingCart;

  const monthlyExpenses = useMemo(() => {
    const { start, end } = getBudgetPeriodDates(budget.period, currentDate, cycleStartDay);
    return transactions
      .filter(tx =>
        tx.category_id === budget.category_id &&
        tx.type === 'expense' &&
        parseBudgetTransactionDate(tx.date) >= start &&
        parseBudgetTransactionDate(tx.date) <= end
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, budget.category_id, budget.period, currentDate, cycleStartDay]);

  const trafficLight = getBudgetTrafficLight(budgetStat.spent, budgetStat.current_limit, budget.alert_threshold);
  const percentage = trafficLight.percentage;

  // Cálculos de días
  const today = new Date();
  const budgetPeriod = getBudgetPeriodDates(budget.period, currentDate, cycleStartDay);
  const daysRemaining = Math.max(0, Math.ceil((budgetPeriod.end.getTime() - Math.max(today.getTime(), budgetPeriod.start.getTime())) / 86400000));
  const idealDailyRemaining = daysRemaining > 0 ? budgetStat.remaining / daysRemaining : 0;

  // Transacciones totales de la categoría para el gráfico
  const allCategoryTransactions = useMemo(() => {
    return transactions.filter(tx => tx.category_id === budget.category_id && tx.type === 'expense');
  }, [transactions, budget.category_id]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-28">
      <FinancialPeriodNavigator/>

      {/* Header Compacto (Nuevo Diseño) */}
      <div className="w-full bg-white dark:bg-surface-card rounded-3xl shadow-sm border border-transparent dark:border-border-subtle flex flex-col relative overflow-hidden">

        {/* Top Section */}
        <div className="flex flex-row items-center gap-4 p-5 md:p-6 w-full">
          {/* Icon */}
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            <IconComponent size={32} />
          </div>

          {/* Info */}
          <div className="flex flex-col flex-1 gap-1 min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full capitalize tracking-wide whitespace-nowrap"
                style={{ backgroundColor: `${color}20`, color: color }}
              >
                {budget.period === 'weekly' ? 'Semanal' : budget.period === 'monthly' ? 'Mensual' : 'Anual'}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold md:text-xs ${trafficLight.badgeClassName}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${trafficLight.dotClassName}`} aria-hidden="true" />
                {trafficLight.label}
              </span>
              {budgetStat.status === 'expired' && (
                <span className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap bg-default-200 text-default-600">
                  Expirado
                </span>
              )}
            </div>
            <h1 className="text-lg md:text-2xl font-bold text-foreground leading-tight line-clamp-2">
              {category?.name || 'Categoría'}
            </h1>
          </div>

          {/* Buttons */}
          <div className="flex flex-row gap-2 self-start flex-shrink-0 mt-1">
            <Button size="sm" isIconOnly variant="ghost" className="bg-default-100 dark:bg-surface-raised text-default-600 hover:text-foreground border-transparent rounded-full" onPress={() => setIsEditModalOpen(true)}>
              <Edit2 size={16} />
            </Button>
            <Button size="sm" isIconOnly variant="ghost" className="bg-danger/10 hover:bg-danger/20 text-danger border-transparent rounded-full" onPress={() => setIsDeleteModalOpen(true)}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        {/* Separator */}
        <div className="w-[calc(100%-2.5rem)] mx-auto h-[1px] bg-black/5 dark:bg-white/5" />

        {/* Progress Bar */}
        <div className="w-[calc(100%-2.5rem)] mx-auto mt-4 px-2">
          <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${trafficLight.barClassName}`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-3 px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
          <div className="flex flex-col items-center justify-center text-center gap-1 border-r border-black/5 dark:border-white/5">
            <Target size={18} className="text-[#5a5a72] dark:text-[#a0a0b8]" />
            <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] lowercase">límite</span>
            <span className="text-sm md:text-lg font-bold text-foreground">${budgetStat.current_limit.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1 border-r border-black/5 dark:border-white/5">
            <IconComponent size={18} style={{ color: color }} />
            <span className="text-[10px] md:text-xs font-medium lowercase" style={{ color: color }}>gastado ({Math.round(percentage)}%)</span>
            <span className="text-sm md:text-lg font-bold text-foreground">${budgetStat.spent.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1">
            <Wallet size={18} className={budgetStat.remaining === 0 && budgetStat.current_limit > 0 ? 'text-[#f31260]' : 'text-[#17c964]'} />
            <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] lowercase">disponible</span>
            <span className={`text-sm md:text-lg font-bold ${budgetStat.remaining === 0 && budgetStat.current_limit > 0 ? 'text-[#f31260]' : 'text-foreground'}`}>
              ${budgetStat.remaining.toLocaleString('es-CL')}
            </span>
          </div>
        </div>
      </div>

      {/* Historial Mensual */}
      <div className="flex flex-col gap-4 mt-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ArrowRightLeft size={20} className="text-[#6d28d9]" /> Últimos Movimientos
        </h3>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl overflow-hidden flex flex-col p-2 gap-1">
          {monthlyExpenses.length === 0 ? (
            <div className="p-8 text-center text-default-500 text-sm">
              No hay gastos registrados para esta categoría en {budget.period === 'weekly' ? 'esta semana' : budget.period === 'annual' ? 'este año' : 'este mes'}.
            </div>
          ) : (
            monthlyExpenses.map((tx) => {
              const originAccount = accounts.find(a => a.id === tx.account_id);
              const accountStr = originAccount ? ` · ${originAccount.name}` : '';

              return (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-3 hover:bg-default-50 dark:hover:bg-surface-card rounded-lg transition-colors cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}20`, color: color }}
                    >
                      <IconComponent size={18} />
                    </div>

                    <div className="flex flex-col">
                      <span className="font-bold text-[15px] text-foreground">{tx.name || 'Gasto'}</span>
                      <span className="text-xs text-[#a0a0b8]">
                        {new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(tx.date))}
                        {accountStr}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-[15px] text-danger">
                    -${tx.amount.toLocaleString('es-CL')}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Análisis y Gráficos */}
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={20} className="text-[#6d28d9]" /> Análisis de Gastos
        </h3>
          <div className="flex bg-default-100 dark:bg-surface-card rounded-xl p-1">
            {['1W', '1M', '1Y'].map(range => (
              <button
                key={range}
                onClick={() => setChartRange(range as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartRange === range ? 'bg-white dark:bg-surface-raised text-foreground shadow-sm' : 'text-default-500 hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-4 w-full h-[350px]">
          <BudgetTrendChart
            transactions={allCategoryTransactions}
            currentDate={currentDate}
            limit={budgetStat.current_limit}
            range={chartRange}
            color={color}
          />
        </div>
      </div>

      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          isOpen={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
          categories={categories}
          accounts={accounts}
        />
      )}

      <BudgetEditModal
        budget={budget}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />

      <BudgetDeleteModal
        budget={budget}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      />

    </div>
  );
}
