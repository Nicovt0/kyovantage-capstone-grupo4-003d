import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { FinancialPeriodNavigator } from '@/shared/ui/FinancialPeriodNavigator';
import { periodCashflow, periodTransactions } from '@/features/app-shell/model/financialPeriod';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, isInFinancialCycle } from '@/utils/financialCycle';
import { selectActiveAccounts } from '@/features/wallet/selectors/accountSelectors';
import { Link, useNavigate } from 'react-router-dom';
import { Account, Bank, Category, Transaction } from "@/types";
import { useState, useMemo } from "react";
import { Tabs, Button } from "@heroui/react";
import { MonthlySummaryWidget } from "./MonthlySummaryWidget";
import { WealthChart } from "./WealthChart";
import { AccountCard } from "./AccountCard";
import { Plus, ArrowRightLeft, ChevronLeft, ChevronRight, Wallet, PiggyBank } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { TransactionDetailModal } from "./transactions/TransactionDetailModal";

interface WalletOverviewProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  banks: Bank[];
  onAddAccount?: () => void;
}

export function WalletOverview({ accounts, transactions, categories, banks, onAddAccount }: WalletOverviewProps) {

  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const navigate = useNavigate();
  const {cycle:navigatedCycle}=useFinancialPeriod();
  const [activeTab, setActiveTab] = useState<'cuentas' | 'gastos'>('cuentas');
  const selectedCycle=useMemo(()=>activeTab==='gastos' ? navigatedCycle:getFinancialCycle(new Date(),cycleStartDay),[activeTab,navigatedCycle,cycleStartDay]);
  const currentMonth=selectedCycle.start;
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const {income,expense,surplus}=useMemo(()=>periodCashflow(transactions,selectedCycle),[transactions,selectedCycle]);

  const { monthlyCategoryExpenses, totalExpenses } = useMemo(() => {
    const cycle = getFinancialCycle(currentMonth, cycleStartDay);
    const expenses = transactions.filter(tx =>
      tx.type === 'expense' && !tx.billing_payment &&
      tx.status === 'paid' &&
      isInFinancialCycle(tx.date, cycle) &&
      !tx.transfer_group_id &&
      !tx.name?.toLowerCase().includes('transferencia')
    );

    const map: Record<string, { total: number, category?: Category }> = {};
    expenses.forEach(tx => {
      const catId = tx.category_id || 'otros';
      if (!map[catId]) {
        map[catId] = { total: 0, category: categories.find(c => c.id === catId) };
      }
      map[catId].total += tx.amount;
    });

    const totalExpenses = Object.values(map).reduce((sum, item) => sum + item.total, 0);

    return {
      monthlyCategoryExpenses: Object.values(map).sort((a, b) => b.total - a.total),
      totalExpenses
    };
  }, [transactions, currentMonth, categories, cycleStartDay]);

  const sortedAccounts = useMemo(() => {
    return selectActiveAccounts(accounts)
      .sort((a, b) => {
        if (a.bank_id === null && b.bank_id !== null) return -1;
        if (a.bank_id !== null && b.bank_id === null) return 1;
        return 0;
      });
  }, [accounts]);

  const regularAccounts = sortedAccounts.filter(a => a.type?.toLowerCase() !== 'ahorro' && !a.name?.toLowerCase().includes('ahorro'));
  const savingAccounts = sortedAccounts.filter(a => a.type?.toLowerCase() === 'ahorro' || a.name?.toLowerCase().includes('ahorro'));

  const totalBalance = useMemo(() => regularAccounts.reduce((sum, a) => sum + a.balance, 0), [regularAccounts]);

  const recentTransactions = useMemo(() => {
    const result: any[] = [];
    const skipIds = new Set<string>();

    const periodRows=[...(activeTab==='gastos' ? periodTransactions(transactions,selectedCycle):transactions)].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
    for (const tx of periodRows) {
      if (skipIds.has(tx.id)) continue;

      // Solo agrupar las dos filas de una transferencia explícitamente vinculada.
      const match = periodRows.find(t =>
        !skipIds.has(t.id) &&
        t.id !== tx.id &&
        Boolean(tx.transfer_group_id) &&
        t.transfer_group_id === tx.transfer_group_id &&
        t.account_id !== tx.account_id &&
        t.type !== tx.type
      );

      if (match) {
        skipIds.add(match.id);
        const expenseTx = tx.type === 'expense' ? tx : match;
        const incomeTx = tx.type === 'income' ? tx : match;

        const originAccount = accounts.find(a => a.id === expenseTx.account_id);
        const destAccount = accounts.find(a => a.id === incomeTx.account_id);

        result.push({
          ...expenseTx,
          isGroupedTransfer: true,
          transferText: `${originAccount?.name || 'Origen'} → ${destAccount?.name || 'Destino'}`
        });
        continue;
      }

      result.push(tx);
      if (result.length >= 5) break;
    }
    return result.slice(0, 5);
  }, [transactions, accounts, selectedCycle, activeTab]);

  return (
    <div className="flex flex-col gap-6">

      {/* Selector Cuentas / Gastos tipo Tarjetas */}
      <div className="flex w-full gap-3 mt-2">
        <button
          onClick={() => setActiveTab('cuentas')}
          className={`flex-1 flex flex-col justify-center items-center py-4 px-2 rounded-2xl border transition-all ${
            activeTab === 'cuentas'
              ? 'bg-brand-primary/10 border-[#6d28d9] shadow-sm'
              : 'bg-white dark:bg-surface-card border-transparent dark:border-border-subtle shadow-sm hover:border-[#6d28d9]/50'
          }`}
        >
          <span className={`text-xs font-medium tracking-widest uppercase ${activeTab === 'cuentas' ? 'text-[#6d28d9]' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
            Cuentas
          </span>
        </button>
        <button
          onClick={() => setActiveTab('gastos')}
          className={`flex-1 flex flex-col justify-center items-center py-4 px-2 rounded-2xl border transition-all ${
            activeTab === 'gastos'
              ? 'bg-brand-primary/10 border-[#6d28d9] shadow-sm'
              : 'bg-white dark:bg-surface-card border-transparent dark:border-border-subtle shadow-sm hover:border-[#6d28d9]/50'
          }`}
        >
          <span className={`text-xs font-medium tracking-widest uppercase ${activeTab === 'gastos' ? 'text-[#6d28d9]' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
            Gastos
          </span>
        </button>
      </div>

      {activeTab==='gastos' && <FinancialPeriodNavigator showCurrentValuesNote={false}/>}

      {/* Gráfico */}
      <div className="w-full flex items-center justify-center -my-2">
        <WealthChart
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          activeTab={activeTab}
          currentMonth={currentMonth}
        />
      </div>

      {/* Resúmenes Inferiores Individuales */}
      <div className="flex w-full gap-2 md:gap-4">
        <div className="flex-1 flex flex-col justify-center items-center p-3 md:p-5 rounded-2xl bg-white dark:bg-surface-card shadow-sm border border-transparent dark:border-border-subtle hover:scale-[1.02] transition-transform text-center">
          <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider mb-1">Ingresos</span>
          <span className="font-light tracking-tight text-success text-lg md:text-xl">${income.toLocaleString('es-CL')}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center p-3 md:p-5 rounded-2xl bg-white dark:bg-surface-card shadow-sm border border-transparent dark:border-border-subtle hover:scale-[1.02] transition-transform text-center">
          <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider mb-1">Gastos</span>
          <span className="font-light tracking-tight text-danger text-lg md:text-xl">${expense.toLocaleString('es-CL')}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center p-3 md:p-5 rounded-2xl bg-white dark:bg-surface-card shadow-sm border border-transparent dark:border-border-subtle hover:scale-[1.02] transition-transform text-center">
          <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider mb-1">Excedente</span>
          <span className={`font-light tracking-tight text-lg md:text-xl ${surplus > 0 ? 'text-success' : surplus < 0 ? 'text-danger' : 'text-warning'}`}>
            {surplus < 0 ? '-$' : '$'}{Math.abs(surplus).toLocaleString('es-CL')}
          </span>
        </div>
      </div>

      {/* Contenido Dinámico según Tab */}
      {activeTab === 'cuentas' ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground font-bold text-lg">
                <Wallet size={20} className="text-[#6d28d9]" />
                <h2>Mis Cuentas</h2>
              </div>
              <div className="text-sm font-medium text-foreground bg-default-100 dark:bg-surface-card px-3 py-1 rounded-full">
                {sortedAccounts.length} cuentas
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularAccounts.map(acc => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  bank={banks.find(b => b.id === acc.bank_id)}
                  percentage={totalBalance > 0 ? (acc.balance / totalBalance) * 100 : 0}
                />
              ))}
              <div
                onClick={() => {
                  if (onAddAccount) {
                    onAddAccount();
                  } else {
                    navigate('/wallet/account/add');
                  }
                }}
                className="flex-1 min-h-[140px] bg-transparent border-2 border-dashed border-default-200 dark:border-border-subtle rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-default-50 dark:hover:bg-surface-card transition-colors cursor-pointer text-default-500 hover:text-foreground"
              >
                <div className="w-12 h-12 rounded-full bg-default-100 dark:bg-surface-raised flex items-center justify-center text-default-400">
                  <Plus size={24} />
                </div>
                <span className="font-semibold text-sm">Añadir Cuenta</span>
              </div>
            </div>
          </div>

          {savingAccounts.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-lg">
                <PiggyBank size={20} className="text-[#6d28d9]" />
                <h2>Mis Ahorros</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savingAccounts.map(acc => (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    bank={banks.find(b => b.id === acc.bank_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-foreground">Gastos por Categoría</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monthlyCategoryExpenses.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ backgroundColor: '#a0a0b820', color: '#a0a0b8' }}>
                    {(() => {
                      const Icon = item.category?.icon_name ? (LucideIcons as any)[item.category.icon_name] : LucideIcons.ShoppingCart;
                      return Icon ? <Icon size={16} /> : <LucideIcons.ShoppingCart size={16} />;
                    })()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-foreground">{item.category?.name || 'Otros'}</span>
                    <span className="text-[11px] text-default-500 font-normal">{((item.total / (totalExpenses || 1)) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <span className="font-normal text-danger text-[15px]">${item.total.toLocaleString('es-CL')}</span>
              </div>
            ))}
            {monthlyCategoryExpenses.length === 0 && (
              <p className="text-sm text-default-500 col-span-2 text-center py-8">
                No hay gastos registrados en este mes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Últimos Movimientos */}
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
                    <span className="font-normal text-[15px] text-foreground">{tx.name}</span>
                    <span className="text-xs text-[#a0a0b8] font-light">
                      {isTransfer ? `Transferencia · ${tx.transferText}` : `${dateStr}${accountStr}`}
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
