import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { financialCycleForMonth, getFinancialCycle, financialCycleLabel, cycleDays, parseFinancialDate } from '@/utils/financialCycle';
import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { RecurringTemplate } from '@/types';

interface AgendaCalendarViewProps {
  currentMonth: number; // 1-12
  currentYear: number;
  events: RecurringTemplate[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  onChangeMonth: (month: number, year: number) => void;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function AgendaCalendarView({
  currentMonth,
  currentYear,
  events = [],
  selectedDate,
  onSelectDate,
  onChangeMonth,
}: AgendaCalendarViewProps) {
  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const today = useMemo(() => new Date(), []);

  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const cycle = financialCycleForMonth(currentYear, currentMonth - 1, cycleStartDay);
  const days = cycleDays(cycle);
  const daysInMonth = days.length;
  const firstDayWeekday = (cycle.start.getDay() + 6) % 7;
  const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const eventsByDay = new Map<string, RecurringTemplate[]>();
  for (const event of safeEvents) {
    if (!event.due_date) continue;
    const key = dateKey(parseFinancialDate(event.due_date));
    eventsByDay.set(key, [...(eventsByDay.get(key) || []), event]);
  }

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onChangeMonth(12, currentYear - 1);
    } else {
      onChangeMonth(currentMonth - 1, currentYear);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onChangeMonth(1, currentYear + 1);
    } else {
      onChangeMonth(currentMonth + 1, currentYear);
    }
  };

  const handleToday = () => {
    const now = new Date();
    const current = getFinancialCycle(now, cycleStartDay).start;
    onChangeMonth(current.getMonth() + 1, current.getFullYear());
    onSelectDate(now);
  };

  // Metrics for current month
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let totalExpected = 0;

    safeEvents.forEach((ev) => {
      totalExpected += Number(ev.amount || ev.expected_amount || 0);
      if (ev.status === 'paid') paidCount++;
      else if (ev.status === 'overdue') overdueCount++;
      else pendingCount++;
    });

    return { pendingCount, paidCount, overdueCount, totalExpected };
  }, [safeEvents]);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-surface-card p-5 shadow-xl text-foreground relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 w-60 h-60 bg-brand-primary/10 dark:bg-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle relative z-10">
        <div className="flex min-w-0 items-center gap-2">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-brand-primary/20 border border-[#6d28d9]/40 flex items-center justify-center text-brand-primary dark:text-[#a78bfa]">
            <CalendarIcon size={18} />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-extrabold tracking-tight text-foreground">
              <span>{financialCycleLabel(cycle)}</span>
            </h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-surface-raised hover:bg-surface-raised text-on-surface-card-body transition-colors"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-surface-raised hover:bg-surface-raised text-on-surface-card-body transition-colors"
            title="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-surface-raised hover:bg-surface-raised text-on-surface-card-body transition-colors"
            title="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Metric summary badges */}
      <div className="grid grid-cols-3 gap-2 relative z-10 text-xs">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 flex flex-col items-center text-center">
          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400/80 flex items-center gap-1">
            <Clock size={10} /> Pendientes
          </span>
          <span className="text-base font-black text-amber-700 dark:text-amber-400 mt-0.5">{metrics.pendingCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 flex flex-col items-center text-center">
          <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400/80 flex items-center gap-1">
            <CheckCircle2 size={10} /> Pagados
          </span>
          <span className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{metrics.paidCount}</span>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 flex flex-col items-center text-center">
          <span className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400/80 flex items-center gap-1">
            <AlertTriangle size={10} /> Vencidos
          </span>
          <span className="text-base font-black text-red-700 dark:text-red-400 mt-0.5">{metrics.overdueCount}</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-col gap-1 relative z-10">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAY_NAMES_ES.map((dayName, idx) => (
            <div
              key={dayName}
              className={`text-[11px] font-bold uppercase tracking-wider py-1 ${
                idx >= 5 ? 'text-on-surface-card-secondary' : 'text-on-surface-card-secondary'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Days cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty offset cells before 1st day of month */}
          {Array.from({ length: firstDayWeekday }).map((_, i) => (
            <div key={`offset-${i}`} className="h-11 md:h-12 rounded-xl opacity-0 pointer-events-none" />
          ))}

          {/* Month day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = days[i];
            const dayNum = date.getDate();
            const dayEvents = eventsByDay.get(dateKey(date)) || [];

            const isCurrentDay = dateKey(today) === dateKey(date);
            const isSelected = selectedDate && dateKey(selectedDate) === dateKey(date);

            // Determine status indicator colors
            const hasOverdue = dayEvents.some((e) => e.status === 'overdue');
            const hasPending = dayEvents.some((e) => e.status === 'pending');
            const hasPaid = dayEvents.some((e) => e.status === 'paid');

            let indicatorBg = '';
            if (hasOverdue) indicatorBg = 'bg-[#ef4444] shadow-sm shadow-red-500/50';
            else if (hasPending) indicatorBg = 'bg-[#f59e0b] shadow-sm shadow-amber-500/50';
            else if (hasPaid) indicatorBg = 'bg-[#10b981] shadow-sm shadow-emerald-500/50';

            return (
              <button
                key={dateKey(date)}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onSelectDate(null); // toggle off
                  } else {
                    onSelectDate(date);
                  }
                }}
                className={`h-11 md:h-12 rounded-xl p-1 flex flex-col items-center justify-between border transition-all text-xs relative ${
                  isSelected
                    ? 'border-[#8b5cf6] bg-[#8b5cf6]/20 font-black shadow-md shadow-[#8b5cf6]/30 text-foreground scale-[1.03] z-20'
                    : isCurrentDay
                    ? 'border-[#6d28d9] bg-brand-primary/10 text-foreground font-bold'
                    : 'border-border-subtle bg-surface-input/60 hover:bg-surface-raised text-on-surface-card-body'
                }`}
              >
                {/* Day Number */}
                <span
                  className={`text-[12px] leading-none mt-0.5 ${
                    isCurrentDay
                      ? 'w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center font-black'
                      : ''
                  }`}
                >
                  {dayNum}{date.getDate() === 1 && <small className="ml-0.5 text-[8px]">{MONTH_NAMES_ES[date.getMonth()].slice(0, 3)}</small>}
                </span>

                {/* Event Status Badges / Indicators */}
                <div className="flex items-center gap-0.5 mb-1">
                  {dayEvents.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      <span className={`w-2 h-2 rounded-full ${indicatorBg}`} />
                      {dayEvents.length > 1 && (
                        <span className="text-[9px] font-mono font-bold text-on-surface-card-body ml-0.5">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day filter notification */}
      {selectedDate && (
        <div className="flex items-center justify-between bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-xl p-2.5 text-xs text-brand-primary dark:text-[#c4b5fd] mt-1 relative z-10">
          <span>
            Filtrando por día: <strong>{selectedDate.getDate()} de {MONTH_NAMES_ES[selectedDate.getMonth()]}</strong>
          </span>
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="text-[11px] underline hover:text-foreground font-bold"
          >
            Ver mes completo
          </button>
        </div>
      )}
    </div>
  );
}
