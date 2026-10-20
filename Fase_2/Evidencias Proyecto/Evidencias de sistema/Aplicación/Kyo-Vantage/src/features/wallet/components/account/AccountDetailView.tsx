import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, financialCycleForMonth, isInFinancialCycle, cycleDays } from '@/utils/financialCycle';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Account, Transaction, Category, Bank } from '@/types';
import { Button, Spinner } from '@heroui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import * as LucideIcons from 'lucide-react';
import { CalendarOff, ChevronLeft, ChevronRight, ChevronDown, Edit2, Plus, ShoppingCart, Landmark, TrendingUp, TrendingDown, Trash2, BarChart3, ArrowRightLeft } from 'lucide-react';
import { deleteAccount } from '@/features/wallet/api/accountRepository';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

import { AccountEditModal } from "./AccountEditModal";
import { TransactionDetailModal } from "../transactions/TransactionDetailModal";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";
import { WeeklyNavigator } from '@/shared/ui/WeeklyNavigator';

interface AccountDetailViewProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  bank?: Bank;
  banks: Bank[];
}

export function AccountDetailView({ account, transactions, categories, bank, banks }: AccountDetailViewProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [chartRange, setChartRange] = useState<'1W' | '1M' | '1Y'>('1W');

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [weekOffset, setWeekOffset] = useState(0);

  // --- 1. Header Patrimonial ---
  const bgColor = bank?.color || account.color || '#6d28d9';
  const isCashAccount = account.name.toLowerCase() === 'efectivo' && account.bank_id === null;

  // --- 3. Navegación Semanal ---
  const baseMonday = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }, [today]);

  const currentWeekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + weekOffset * 7 + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [baseMonday, weekOffset]);



  // --- Mini Resumen Semanal ---
  const weeklySummary = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;

    currentWeekDays.forEach(d => {
      const dayTxs = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getDate() === d.getDate() &&
          txDate.getMonth() === d.getMonth() &&
          txDate.getFullYear() === d.getFullYear();
      });
      ingresos += dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      gastos += dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    });

    return { ingresos, gastos };
  }, [currentWeekDays, transactions]);

  // --- 4. Movimientos del Día ---
  const dayTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate.getDate() === selectedDate.getDate() &&
        txDate.getMonth() === selectedDate.getMonth() &&
        txDate.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedDate]);

  const mappedDayTransactions = useMemo(() => {
    return dayTransactions.map(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      const IconComponent = cat ? ((LucideIcons as any)[cat.icon_name] || ShoppingCart) : ShoppingCart;
      return {
        ...tx,
        icon: IconComponent,
        catName: cat ? cat.name : 'Transacción',
        catColor: cat ? '#a0a0b8' : '#a0a0b8'
      };
    });
  }, [dayTransactions, categories]);

  // --- 2. Gráfico de Tendencias ---
  const chartData = useMemo(() => {
    const data = [];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (chartRange === '1W') {
      const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        const dayTxs = transactions.filter(t => {
          const txD = new Date(t.date);
          return txD.getDate() === d.getDate() && txD.getMonth() === d.getMonth() && txD.getFullYear() === d.getFullYear();
        });

        data.push({
          name: DAYS_ES[d.getDay()],
          ingresos: dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
          gastos: dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
        });
      }
    } else if (chartRange === '1M') {
      for (const date of cycleDays(getFinancialCycle(today, cycleStartDay))) {
        const next = new Date(date); next.setDate(next.getDate() + 1);
        const dayTxs = transactions.filter(tx => isInFinancialCycle(tx.date, { start: date, nextStart: next }));
        data.push({ name: date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }), ingresos: dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0), gastos: dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) });
      }
    } else if (chartRange === '1Y') {
      // Meses del año actual
      for (let i = 0; i < 12; i++) {
        const monthTxs = transactions.filter(t => {
          const d = new Date(t.date);
          return isInFinancialCycle(t.date, financialCycleForMonth(currentYear, i, cycleStartDay));
        });

        data.push({
          name: MONTHS_ES[i],
          ingresos: monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
          gastos: monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
        });
      }
    }
    return data;
  }, [transactions, today, chartRange, cycleStartDay]);

  const getChartTitle = () => {
    if (chartRange === '1W') return 'Resumen Semanal';
    if (chartRange === '1M') return 'Resumen Mensual';
    return 'Resumen Anual';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl">
          <p className="font-semibold text-xs mb-2 text-foreground">{payload[0].payload.name}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={`text-sm font-bold flex items-center gap-2 ${entry.dataKey === 'ingresos' ? 'text-success' : 'text-danger'}`}>
              {entry.dataKey === 'ingresos' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              ${entry.value.toLocaleString('es-CL')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== account.name) return;
    setIsDeleting(true);
    try {
      await runMutation(() => deleteAccount(account.id));
      setShowDeleteModal(false);
      navigate('/wallet');
    } catch (error) {
      console.error("Error deleting account:", error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-28">

      {/* 1. Header Patrimonial */}
      <div className="bg-white dark:bg-surface-card rounded-3xl p-6 border border-transparent dark:border-border-subtle shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${bgColor}20`, color: bgColor }}
            >
              <Landmark size={28} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-foreground truncate">{account.name}</span>
              <span className="text-sm text-[#5a5a72] dark:text-[#a0a0b8]">{bank?.name || 'Efectivo'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" isIconOnly variant="ghost" className="bg-default-100 dark:bg-surface-card text-default-600 hover:text-foreground border-transparent" onPress={() => setIsEditModalOpen(true)}>
              <Edit2 size={16} />
            </Button>
            {!isCashAccount && (
              <Button size="sm" isIconOnly variant="ghost" className="bg-danger/10 text-danger border-transparent" onPress={() => setShowDeleteModal(true)}>
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] font-bold mb-1">Saldo Disponible</span>
          <span className="text-4xl md:text-5xl font-bold text-foreground">
            ${account.balance.toLocaleString('es-CL')}
          </span>
        </div>
      </div>

      {/* 3. Navegación Semanal */}
      <div className="flex flex-col gap-3">
        <WeeklyNavigator
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          baseMonday={baseMonday}
          currentWeekDays={currentWeekDays}
          hasTransaction={(d) => transactions.some(t => {
            const txDate = new Date(t.date);
            return txDate.getDate() === d.getDate() && txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear();
          })}
          activeColor="#6d28d9"
          dotColor="#6d28d9"
        />

        {/* Mini Resumen Semanal */}
        <div className="flex gap-3 mt-2">
          <div className="flex-1 bg-success/10 border border-success/20 rounded-2xl p-3 flex flex-col justify-center">
            <span className="text-[11px] font-bold text-success uppercase tracking-wider mb-0.5">Ingresos Semanales</span>
            <span className="text-base font-bold text-success">+${weeklySummary.ingresos.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex-1 bg-danger/10 border border-danger/20 rounded-2xl p-3 flex flex-col justify-center text-right">
            <span className="text-[11px] font-bold text-danger uppercase tracking-wider mb-0.5">Gastos Semanales</span>
            <span className="text-base font-bold text-danger">-${weeklySummary.gastos.toLocaleString('es-CL')}</span>
          </div>
        </div>
      </div>

      {/* 4. Movimientos del Día */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-[#6d28d9]" /> Últimos Movimientos
          </h3>
          <Link to="/wallet/transactions">
            <span className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">Ver todos</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-4">
          {mappedDayTransactions.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center opacity-50">
              <CalendarOff size={32} className="mb-2" />
              <p className="text-sm font-medium">Sin movimientos el {selectedDate.getDate()} de {MONTHS_ES[selectedDate.getMonth()]}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {mappedDayTransactions.map(tx => {
                const Icon = tx.icon;
                return (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-2 md:p-3 hover:bg-default-50 dark:hover:bg-surface-card rounded-lg transition-colors cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${tx.catColor}20`, color: tx.catColor }}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{tx.name}</span>
                        <span className="text-[11px] text-default-500">{tx.catName}</span>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-success' : 'text-danger'}`}>
                      {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('es-CL')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Gráfico Dinámico */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={20} className="text-[#6d28d9]" /> {getChartTitle()}
          </h3>
          <div className="flex bg-default-100 dark:bg-surface-card rounded-lg p-1">
            {['1W', '1M', '1Y'].map(range => (
              <button
                key={range}
                onClick={() => setChartRange(range as '1W' | '1M' | '1Y')}
                className={`text-xs font-bold px-3 py-1 rounded-md transition-all ${
                  chartRange === range
                    ? 'bg-white dark:bg-surface-raised text-foreground shadow-sm'
                    : 'text-default-500 hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-4 pt-6">
          {mounted && (
            <div className="w-full overflow-x-auto pb-2">
              <div className="min-w-[600px] md:min-w-full h-[220px] pr-4">
                <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.1)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#8E8E93' }}
                      dy={10}
                      minTickGap={5}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#8E8E93' }}
                      tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                    />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#17c964"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#17c964', stroke: '#fff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  stroke="#f31260"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#f31260', stroke: '#fff', strokeWidth: 2 }}
                />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      <AccountEditModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        account={account}
        banks={banks}
      />

      {selectedTx && (
        <TransactionDetailModal
          isOpen={!!selectedTx}
          onOpenChange={(open) => !open && setSelectedTx(null)}
          transaction={selectedTx}
          categories={categories}
          accounts={[account]}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowDeleteModal(false);
            setDeleteConfirmation('');
          }
        }}>
          <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 flex flex-col gap-4 text-center">
              <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-foreground">¿Archivar cuenta?</h2>

              <div className="text-sm text-default-500 bg-default-50 dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-default-100/10 text-left">
                La cuenta dejará de aparecer en tu billetera. Tus movimientos y el historial de pagos se conservarán.
              </div>

              <p className="text-sm text-default-500 mt-2">
                Para confirmar, escribe <b>{account.name}</b> a continuación:
              </p>

              <input
                type="text"
                className="w-full p-3 bg-default-50 dark:bg-surface-card border border-danger/30 rounded-xl text-sm outline-none text-center font-bold text-danger focus:border-danger transition-colors"
                placeholder={account.name}
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />
            </div>

            <div className="flex border-t border-default-100 dark:border-border-subtle bg-default-50/50 dark:bg-surface-card/50">
              <Button
                variant="ghost"
                className="flex-1 rounded-none h-14 font-semibold border-r border-default-100 dark:border-border-subtle"
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
              >
                Cancelar
              </Button>
              <button
                className="flex-1 rounded-none h-14 font-bold text-[#f31260] hover:bg-[#f31260]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                disabled={deleteConfirmation !== account.name || isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? <Spinner size="sm" color="current"/> : 'Archivar Cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
