import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { periodCashflow } from '@/features/app-shell/model/financialPeriod';
import { isInFinancialCycle } from '@/utils/financialCycle';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle } from '@/utils/financialCycle';
import { selectActiveAccounts, selectAccountsTotalBalance } from '@/features/wallet/selectors/accountSelectors';
import { useNavigate, Link } from 'react-router-dom';
import { Account, Bank, BillingStatement, Category, CreditCard, Goal, Budget, Transaction } from "@/types";
import { AgendaWidget } from "./AgendaWidget";
import { FinancialEvolution } from './FinancialEvolution';

const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000) {
    return '$' + (value / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' mill.';
  } else if (value >= 10_000) {
    return '$' + (value / 1_000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' mil';
  }
  return '$' + value.toLocaleString('es-CL');
};
import { CreditCardVisual } from "@/shared/ui/CreditCardVisual";
import { GoalCard } from "@/features/goals/components/dashboard/GoalCard";
import { BudgetCard } from "@/features/budget/components/BudgetCard";
import { CreditCardCarousel } from "@/features/credit-cards/components/CreditCardCarousel";
import { ArrowRightLeft, CreditCard as CreditCardIcon, Target, Flag, Wallet, Coins, Landmark, PiggyBank, AlertCircle, Plus, ShieldCheck, AlertTriangle, TrendingUp } from "lucide-react";
import * as LucideIcons from 'lucide-react';
import { useState, useMemo } from "react";
import { calculateBudgetStats } from "@/utils/budgetEngine";
import { TransactionDetailModal } from "@/features/wallet/components/transactions/TransactionDetailModal";
import { useAvailableLiquidity } from "@/features/dashboard/hooks/useAvailableLiquidity";

interface DashboardOverviewProps {
  accounts: Account[];
  creditCards: CreditCard[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  categories: Category[];
  banks: Bank[];
  billingStatements: BillingStatement[];
  userName?: string;
}

export function DashboardOverview({
  accounts,
  creditCards,
  transactions,
  goals,
  budgets,
  categories,
  banks,
  billingStatements,
  userName
}: DashboardOverviewProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const {cycle,referenceDate:currentDate,isCurrent}=useFinancialPeriod();
  const cashflow=periodCashflow(transactions,cycle);
  const visibleGoals=goals.filter(goal=>new Date(goal.start_date)<cycle.nextStart);
  const navigate = useNavigate();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Hook puro de liquidez y salud (SP2-05)
  const { netAvailable, committedTotal, status } = useAvailableLiquidity();

  // Calcular Patrimonio (Cuentas regulares + ahorros - deudas de crédito)
  const totalBalance = selectAccountsTotalBalance(accounts);
  const pendingAmount = committedTotal;
  const availableBalance = netAvailable;

  const totalCreditDebt = creditCards.reduce((sum, c) => sum + (c.current_debt || 0), 0);
  const netWorth = totalBalance - totalCreditDebt;

  // Badge de salud financiera (Health Chip)
  const renderHealthChip = () => {
    switch (status) {
      case 'healthy':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <ShieldCheck size={14} />
            <span>Saludable</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <AlertTriangle size={14} />
            <span>Alerta Liquidez</span>
          </div>
        );
      case 'deficit':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 shadow-sm">
            <AlertTriangle size={14} />
            <span>En Déficit</span>
          </div>
        );
    }
  };

  // Clasificación de cuentas para las tarjetas inferiores
  const savingsAccounts = selectActiveAccounts(accounts).filter(a => (a.type?.toLowerCase() === 'ahorro' || a.name?.toLowerCase().includes('ahorro')));
  const savingsIds = new Set(savingsAccounts.map(a => a.id));

  const walletAccounts = selectActiveAccounts(accounts).filter(a => a.bank_id === null && !savingsIds.has(a.id));
  const bankAccounts = selectActiveAccounts(accounts).filter(a => a.bank_id !== null && !savingsIds.has(a.id));

  const walletBalance = walletAccounts.reduce((sum, a) => sum + a.balance, 0);
  const bankBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  const savingsBalance = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Últimos Movimientos
  const recentTransactions = (() => {
    const result: any[] = [];
    const skipIds = new Set<string>();

    const sortedTx = [...transactions]
      .filter(t => t.status === 'paid' && isInFinancialCycle(t.date,cycle))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const tx of sortedTx) {
      if (skipIds.has(tx.id)) continue;

      let match;
      if (tx.transfer_group_id) {
        match = sortedTx.find(t =>
          !skipIds.has(t.id) &&
          t.id !== tx.id &&
          t.transfer_group_id === tx.transfer_group_id
        );
      }

      if (match) {
        skipIds.add(match.id);
        const expenseTx = tx.type === 'expense' ? tx : match;
        const incomeTx = tx.type === 'income' ? tx : match;

        const originAccount = accounts.find(a => a.id === expenseTx.account_id);
        const destAccount = accounts.find(a => a.id === incomeTx.account_id);

        result.push({
          ...expenseTx,
          isGroupedTransfer: true,
          transferText: `${originAccount?.name || 'Origen'} → ${destAccount?.name || 'Destino'}`,
          origin_transaction_id: expenseTx.id,
          destination_transaction_id: incomeTx.id
        });
        continue;
      }

      result.push(tx);
      if (result.length >= 5) break;
    }
    return result.slice(0, 5);
  })();

  // Calcular estadísticas de presupuestos
  const budgetsWithStats = useMemo(() => {
    const endOfMonth = getFinancialCycle(currentDate, cycleStartDay).end;
    const activeBudgetsForMonth = budgets.filter(b => {
      if (!b.start_date) return true;
      const startDate = new Date(b.start_date);
      return startDate <= endOfMonth;
    });
    return calculateBudgetStats(activeBudgetsForMonth, transactions.filter(tx=>tx.status!=='pending'), categories, currentDate, cycleStartDay);
  }, [budgets, transactions, categories, cycleStartDay, currentDate]);

  return (
    <div className="flex flex-col gap-10 w-full">

      {/* 1. Patrimonio (Widget Principal) */}
      <div className="flex flex-col gap-4 mt-2">
        {userName && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 px-1 animate-in slide-in-from-left-4 fade-in duration-700">
            <div>
              <h2 className="text-xs md:text-sm text-default-500 font-medium tracking-widest uppercase mb-1">
                Resumen Financiero
              </h2>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight m-0">
                Hola, <span className="bg-gradient-to-r from-[#6d28d9] via-[#9353d3] to-[#b276ff] bg-clip-text text-transparent capitalize">{userName}</span> <span className="inline-block hover:animate-bounce cursor-default">👋</span>
              </h1>
            </div>

            {/* Chips de Salud Financiera y KyoScore */}
            <div className="flex items-center gap-3">
              {isCurrent && renderHealthChip()}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-primary/15 text-[#b276ff] border border-[#6d28d9]/30 shadow-sm">
                <TrendingUp size={14} className="text-[#4CD964]" />
                <span>KyoScore: <strong className="text-foreground">780</strong></span>
              </div>
            </div>
          </div>
        )}

        {!isCurrent && <div className="flex justify-center gap-6 text-sm text-on-surface-card-secondary"><span>Ingresos: <strong className="text-emerald-700 dark:text-emerald-300">${cashflow.income.toLocaleString('es-CL')}</strong></span><span>Gastos: <strong className="text-rose-700 dark:text-rose-300">${cashflow.expense.toLocaleString('es-CL')}</strong></span></div>}
        {/* Nuevo Diseño de Resumen Financiero (Sin bloques) */}
        <div className="flex flex-col items-center justify-center mt-6 mb-4">
          <div className="text-xs text-default-500 dark:text-[#a0a0b8] uppercase tracking-widest mb-2 font-medium flex items-center gap-2">
            <span>{isCurrent ? 'Dinero Libre Disponible':'Excedente del período'}</span>
          </div>
          <div className="text-5xl md:text-6xl font-light text-foreground tracking-tighter mb-6">
            ${(isCurrent ? availableBalance:cashflow.surplus).toLocaleString('es-CL')}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mt-2">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-default-400 dark:text-[#5a5a72] uppercase tracking-wider mb-1">Patrimonio actual</span>
              <span className="text-sm text-default-600 dark:text-default-300 font-medium">${netWorth.toLocaleString('es-CL')}</span>
            </div>

            {isCurrent && pendingAmount > 0 && (
              <>
                <div className="w-px h-6 bg-black/10 dark:bg-surface-raised hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-default-400 dark:text-[#5a5a72] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertCircle size={10} /> Pendientes del Mes
                  </span>
                  <span className="text-sm text-[#f31260] font-medium">−${pendingAmount.toLocaleString('es-CL')}</span>
                </div>
              </>
            )}

            {totalCreditDebt > 0 && (
              <>
                <div className="w-px h-6 bg-black/10 dark:bg-surface-raised hidden sm:block" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-default-400 dark:text-[#5a5a72] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CreditCardIcon size={10} /> Deuda TC
                  </span>
                  <span className="text-sm text-warning font-medium">−${totalCreditDebt.toLocaleString('es-CL')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Distribución de Cuentas (Minimalista) */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 py-6 mb-2">
          <div className="flex flex-col items-center group cursor-pointer" title={`Billetera: $${walletBalance.toLocaleString('es-CL')}`}>
            <div className="flex items-center gap-1.5 text-[11px] text-default-500 uppercase tracking-widest mb-1.5 group-hover:text-[#6d28d9] transition-colors">
              <Wallet size={12} /> Billetera
            </div>
            <span className="text-xl font-light text-foreground">{formatCompactCurrency(walletBalance)}</span>
          </div>

          <div className="flex flex-col items-center group cursor-pointer" title={`Banco: $${bankBalance.toLocaleString('es-CL')}`}>
            <div className="flex items-center gap-1.5 text-[11px] text-default-500 uppercase tracking-widest mb-1.5 group-hover:text-[#6d28d9] transition-colors">
              <Landmark size={12} /> Banco
            </div>
            <span className="text-xl font-light text-foreground">{formatCompactCurrency(bankBalance)}</span>
          </div>

          <div className="flex flex-col items-center group cursor-pointer" title={`Ahorro: $${savingsBalance.toLocaleString('es-CL')}`}>
            <div className="flex items-center gap-1.5 text-[11px] text-default-500 uppercase tracking-widest mb-1.5 group-hover:text-[#17c964] transition-colors">
              <PiggyBank size={12} /> Ahorro
            </div>
            <span className="text-xl font-light text-[#17c964]">{formatCompactCurrency(savingsBalance)}</span>
          </div>
        </div>
      </div>

      <FinancialEvolution transactions={transactions}/>

      {/* 2. Agenda Financiera */}
      <AgendaWidget
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        creditCards={creditCards}
        billingStatements={billingStatements}
        goals={goals}
      />

      {/* 3. Tarjetas de Crédito (Carrusel Simplificado) */}
      <div className="flex flex-col gap-3 -mx-4 md:mx-0 mt-2">
        <div className="flex items-center justify-between px-5 md:px-1">
          <div className="flex items-center gap-2 text-foreground font-medium text-lg">
            <CreditCardIcon size={18} className="text-[#6d28d9]" />
            <span>Mis Tarjetas de Crédito</span>
          </div>
          <Link to="/credit-cards">
            <span className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">Ver todas</span>
          </Link>
        </div>

        {creditCards.length === 0 ? (
          <div className="flex justify-center overflow-hidden px-1 py-1 w-full">
            <Link to="/credit-cards" className="shrink-0 w-[280px] h-[160px] rounded-[20px] p-[18px_20px] flex flex-col items-center justify-center relative overflow-hidden cursor-pointer snap-center transition-transform hover:scale-[1.02] active:scale-95 bg-surface-raised text-foreground group shadow-md border border-border-subtle">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none" />
              <div className="absolute top-[-35%] left-[-15%] w-[55%] h-[160%] bg-white/[0.12] pointer-events-none" style={{ transform: 'rotate(25deg)' }} />
              <div className="w-12 h-12 rounded-full bg-surface-raised text-foreground flex items-center justify-center transition-colors z-10 mb-2 group-hover:bg-surface-raised">
                <Plus size={24} />
              </div>
              <span className="text-[13px] font-medium text-foreground/90 z-10 tracking-wide uppercase">Añadir Tarjeta</span>
            </Link>
          </div>
        ) : (
          <CreditCardCarousel
            creditCards={creditCards}
            banks={banks}
            billingStatements={billingStatements}
            onCardClick={(cardId) => navigate(`/credit-cards/detail?id=${cardId}`)}
            variant="overview"
          />
        )}
      </div>

      {/* 4. Presupuestos */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-foreground font-medium text-lg">
            <Coins size={18} className="text-[#6d28d9]" />
            <span>Presupuestos</span>
          </div>
          <Link to="/planning">
            <span className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">Ver todos</span>
          </Link>
        </div>
        {budgetsWithStats.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetsWithStats.slice(0, 3).map(budgetStat => (
              <BudgetCard
                key={budgetStat.id}
                budget={budgetStat}
                category={budgetStat.category}
                usedAmount={budgetStat.spent}
                currentLimit={budgetStat.current_limit}
              />
            ))}
          </div>
        ) : (
          <Link to="/planning?view=create-budget" className="bg-white dark:bg-surface-card rounded-[20px] p-6 shadow-sm border border-dashed border-black/10 dark:border-border-subtle flex flex-col items-center justify-center gap-2 hover:border-[#6d28d9] hover:bg-brand-primary/5 transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-default-100 dark:bg-surface-card text-default-500 group-hover:bg-brand-primary group-hover:text-white flex items-center justify-center transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-sm font-medium text-default-500 group-hover:text-[#6d28d9] transition-colors">Añadir Presupuesto</span>
          </Link>
        )}
      </div>

      {/* 5. Metas */}
      {visibleGoals.length > 0 ? (
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-foreground font-medium text-lg">
              <Flag size={18} className="text-[#6d28d9]" />
              <span>Metas</span>
            </div>
            <Link to="/planning">
              <span className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">Ver todas</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleGoals.slice(0, 3).map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-foreground font-medium text-lg">
              <Flag size={18} className="text-[#6d28d9]" />
              <span>Metas</span>
            </div>
          </div>
          <Link to="/planning?view=create-goal" className="bg-white dark:bg-surface-card rounded-[20px] p-6 shadow-sm border border-dashed border-black/10 dark:border-border-subtle flex flex-col items-center justify-center gap-2 hover:border-[#6d28d9] hover:bg-brand-primary/5 transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-default-100 dark:bg-surface-card text-default-500 group-hover:bg-brand-primary group-hover:text-white flex items-center justify-center transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-sm font-medium text-default-500 group-hover:text-[#6d28d9] transition-colors">Añadir Meta</span>
          </Link>
        </div>
      )}

      {/* 6. Últimos Movimientos */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-foreground font-medium text-lg">
            <ArrowRightLeft size={18} className="text-[#6d28d9]" />
            <span>Últimos movimientos</span>
          </div>
          <Link to="/wallet/transactions">
            <span className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">Ver todos</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-3 flex flex-col gap-2">
          {recentTransactions.length === 0 && (
            <p className="text-sm text-default-500 text-center py-4">No hay movimientos recientes.</p>
          )}
          {recentTransactions.map(tx => {
            const isTransfer = tx.isGroupedTransfer;
            const txDate = new Date(tx.date);
            const isToday = txDate.getDate() === new Date().getDate() && txDate.getMonth() === new Date().getMonth() && txDate.getFullYear() === new Date().getFullYear();
            const dateStr = isToday ? 'Hoy' : txDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

            const originAccount = accounts.find(a => a.id === tx.account_id);
            const accountStr = originAccount ? ` · ${originAccount.name}` : '';

            const cat = categories.find(c => c.id === tx.category_id);
            const IconComponent = cat && !isTransfer ? ((LucideIcons as any)[cat.icon_name] || LucideIcons.ShoppingCart) : null;
            return (
              <div
                key={tx.id}
                className="flex justify-between items-center hover:bg-default-50 dark:hover:bg-surface-card p-3 rounded-2xl transition-colors cursor-pointer"
                onClick={() => setSelectedTx(tx)}
              >
                <div className="flex items-center gap-4">
                  {isTransfer ? (
                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-[#6d28d9]">
                      <ArrowRightLeft size={20} />
                    </div>
                  ) : (
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        backgroundColor: cat ? '#a0a0b820' : (tx.type === 'income' ? 'rgba(23, 201, 100, 0.1)' : 'rgba(243, 18, 96, 0.1)'),
                        color: cat ? '#a0a0b8' : (tx.type === 'income' ? '#17c964' : '#f31260')
                      }}
                    >
                      {IconComponent ? <IconComponent size={20} /> : <span className="font-bold">{tx.name?.charAt(0).toUpperCase()}</span>}
                    </div>
                  )}

                  <div className="flex flex-col">
                    <span className="font-normal text-[15px] text-foreground">{isTransfer ? 'Transferencia' : tx.name}</span>
                    <span className="text-xs text-[#a0a0b8] font-light">
                      {dateStr}{isTransfer ? ` · ${tx.transferText}` : accountStr}
                    </span>
                  </div>
                </div>
                <span className={`font-normal text-[15px] ${isTransfer ? 'text-foreground' : tx.type === 'income' ? 'text-success' : 'text-danger'}`}>
                  {isTransfer ? '' : tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('es-CL')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedTx && (
        <TransactionDetailModal
          isOpen={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
          transaction={selectedTx}
          categories={categories}
          accounts={accounts}
        />
      )}

    </div>
  );
}
