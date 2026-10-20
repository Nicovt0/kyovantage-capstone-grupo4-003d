import { useState, useMemo, useEffect } from 'react';
import { CalendarOff, ShoppingCart, ArrowRightLeft } from 'lucide-react';
import { WeeklyNavigator } from '@/shared/ui/WeeklyNavigator';
import * as LucideIcons from 'lucide-react';
import { Transaction, Category } from '@/types';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FULL_MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface CreditCardWeeklyNavigatorProps {
  transactions: Transaction[];
  categories: Category[];
  color: string;
}

export function CreditCardWeeklyNavigator({ transactions, categories, color }: CreditCardWeeklyNavigatorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [weekOffset, setWeekOffset] = useState(0);

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

  if (!mounted) return <div className="h-[200px] w-full animate-pulse bg-default-100 rounded-3xl" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Navegación Semanal */}
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
        activeColor={color}
        dotColor={color}
      />

      {/* Movimientos del Día */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-[#6d28d9]" /> Últimos Movimientos
          </h3>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-4">
          {mappedDayTransactions.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center opacity-50">
              <CalendarOff size={32} className="mb-2 text-[#5a5a72] dark:text-[#a0a0b8]" />
              <p className="text-sm font-medium text-[#5a5a72] dark:text-[#a0a0b8]">Sin movimientos el {selectedDate.getDate()} de {MONTHS_ES[selectedDate.getMonth()]}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {mappedDayTransactions.map(tx => {
                const Icon = tx.icon;
                return (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-2 md:p-3 hover:bg-default-50 dark:hover:bg-surface-card rounded-xl transition-colors"
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
                        <span className="text-[11px] text-[#5a5a72] dark:text-[#a0a0b8]">{tx.catName}</span>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-foreground">
                      ${tx.amount.toLocaleString('es-CL')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
