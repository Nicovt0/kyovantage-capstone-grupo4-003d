import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { isInFinancialCycle } from '@/utils/financialCycle';
import { useState, useRef } from 'react';
import { Transaction, Category, Account, CreditCard, BillingStatement, Goal } from '@/types';
import * as LucideIcons from 'lucide-react';
import { CreditCard as CreditCardIcon, CalendarDays, Check } from 'lucide-react';
import { PaymentValidationModalV3 } from '@/features/dashboard/components/PaymentValidationModalV3';
import { BillingPaymentModalV3 } from '@/features/dashboard/components/BillingPaymentModalV3';
import { AgendaPaymentModal } from '@/features/agenda/components/AgendaPaymentModal';
import { Link } from 'react-router-dom';
import { useAgendaEvents } from '@/features/agenda/hooks/useAgendaEvents';
import type { RecurringTemplate } from '@/types';

interface AgendaWidgetProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  creditCards: CreditCard[];
  billingStatements: BillingStatement[];
  goals: Goal[];
}

export function AgendaWidget({ transactions, categories, accounts, creditCards, billingStatements, goals }: AgendaWidgetProps) {
  const {cycle}=useFinancialPeriod();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<BillingStatement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenTxIds, setHiddenTxIds] = useState<Set<string>>(new Set());
  const [hiddenStmtIds, setHiddenStmtIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<RecurringTemplate | null>(null);

  const { events = [], payCommitment, isPaying } = useAgendaEvents({month:cycle.start.getMonth()+1,year:cycle.start.getFullYear()});

  const pendingTx = transactions.filter(t => t.status === 'pending' && isInFinancialCycle(t.due_date || t.date, cycle) && !hiddenTxIds.has(t.id));
  const pendingStatements = (billingStatements || []).filter(s => (s.status === 'pending' || s.status === 'partial') && Boolean(s.payment_due_date) && isInFinancialCycle(s.payment_due_date!, cycle) && !hiddenStmtIds.has(s.id));
  const pendingEvents = (events || []).filter(e => (e.status === 'pending' || e.status === 'overdue' || !e.status) && !hiddenTxIds.has(e.id));

  const combinedPendingItems = [
    ...pendingTx.map(tx => ({
      type: 'tx' as const,
      data: tx,
      dueDate: tx.due_date ? new Date(tx.due_date).getTime() : 0,
      dueDateStr: tx.due_date || ''
    })),
    ...pendingStatements.map(stmt => ({
      type: 'stmt' as const,
      data: stmt,
      dueDate: stmt.payment_due_date ? new Date(stmt.payment_due_date).getTime() : 0,
      dueDateStr: stmt.payment_due_date || ''
    })),
    ...pendingEvents.map(evt => {
      let dueDateStr = evt.due_date ? String(evt.due_date) : '';
      if (!dueDateStr && evt.payment_day) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(evt.payment_day).padStart(2, '0');
        dueDateStr = `${year}-${month}-${day}`;
      }
      return {
        type: 'event' as const,
        data: evt,
        dueDate: dueDateStr ? new Date(dueDateStr).getTime() : 0,
        dueDateStr
      };
    })
  ].sort((a, b) => a.dueDate - b.dueDate);

  const totalPending = combinedPendingItems.length;

  const calculateDaysLeft = (dueDate?: string) => {
    if (!dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate.split('T')[0] + 'T00:00:00');
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const getCardStyles = (daysLeft: number) => {
    if (daysLeft < 0) {
      // Vencido -> Rojo
      return {
        iconWrap: 'bg-[#f31260]/10 text-[#f31260]',
        tag: 'bg-[#f31260]/10 text-[#f31260]',
        btn: 'bg-[#f31260] text-white hover:bg-[#f31260]/90',
        cardHover: 'hover:border-[#f31260]/50'
      };
    } else if (daysLeft === 0) {
      // Fecha límite (Hoy) -> Naranjo
      return {
        iconWrap: 'bg-[#f5a524]/10 text-[#f5a524]',
        tag: 'bg-[#f5a524]/10 text-[#f5a524]',
        btn: 'bg-[#f5a524]/10 text-[#f5a524] hover:bg-[#f5a524]/20',
        cardHover: 'hover:border-[#f5a524]/50'
      };
    } else if (daysLeft <= 7) {
      // Queda poco tiempo -> Amarillo
      return {
        iconWrap: 'bg-[#eab308]/10 text-[#eab308]',
        tag: 'bg-[#eab308]/10 text-[#eab308]',
        btn: 'bg-[#eab308]/10 text-[#eab308] hover:bg-[#eab308]/20',
        cardHover: 'hover:border-[#eab308]/50'
      };
    } else {
      // Plazo aceptable -> Verde
      return {
        iconWrap: 'bg-[#17c964]/10 text-[#17c964]',
        tag: 'bg-[#17c964]/10 text-[#17c964]',
        btn: 'bg-[#17c964]/10 text-[#17c964] hover:bg-[#17c964]/20',
        cardHover: 'hover:border-[#17c964]/50'
      };
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-foreground font-medium text-lg">
          <CalendarDays size={18} className="text-[#6d28d9]" />
          <span>Agenda financiera</span>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <span className="text-xs font-medium text-[#f31260] bg-[#f31260]/10 px-3 py-1 rounded-full">
              {totalPending} pendientes
            </span>
          )}
          <Link to="/agenda" className="text-sm font-medium text-[#6d28d9] hover:underline cursor-pointer">
            Ver todas
          </Link>
        </div>
      </div>

      {totalPending === 0 ? (
        <div className="bg-white dark:bg-surface-card rounded-[24px] p-6 shadow-sm border border-transparent dark:border-border-subtle flex flex-col items-center justify-center gap-3 text-center min-h-[160px]">
          <div className="w-12 h-12 rounded-full bg-brand-primary/10 text-[#6d28d9] flex items-center justify-center">
            <Check size={24} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-foreground">¡Todo al día!</span>
            <span className="text-[13px] text-default-500">No tienes pagos ni metas pendientes en este período.</span>
          </div>
        </div>
      ) : (
        <div className="relative w-full">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const scrollPosition = target.scrollLeft;
            const cardWidth = 266; // 250px card + 16px gap
            const newIndex = Math.round(scrollPosition / cardWidth);
            if (newIndex !== activeIndex) {
              setActiveIndex(newIndex);
            }
          }}
        >
          {combinedPendingItems.map((item, index) => {
            if (item.type === 'stmt') {
              const stmt = item.data as BillingStatement;
              const card = creditCards.find(c => c.id === stmt.credit_card_id);
              const daysLeft = calculateDaysLeft(stmt.payment_due_date);
              const styles = getCardStyles(daysLeft);
              const remaining = stmt.total_due - stmt.amount_paid;

              return (
                <div
                  key={`billing-${stmt.id}`}
                  className={`shrink-0 w-[250px] bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl snap-start overflow-hidden flex flex-col transition-colors ${styles.cardHover}`}
                >
                  <div className="p-4 flex items-center gap-3 border-b border-default-100 dark:border-border-subtle">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconWrap}`}>
                      <CreditCardIcon size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-foreground truncate">{card?.name || 'Tarjeta'}</span>
                      <span className="text-[11px] text-default-500 truncate">
                        Estado de cuenta · {stmt.payment_due_date ? new Date(stmt.payment_due_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col">
                      <span className="text-3xl font-light tracking-tight text-[#f31260]">-${remaining.toLocaleString('es-CL')}</span>
                      {stmt.amount_paid > 0 && (
                        <span className="text-xs text-[#17c964] font-medium mt-1">Abonado: ${stmt.amount_paid.toLocaleString('es-CL')}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-medium px-3 py-1 rounded-full ${styles.tag}`}>
                        {daysLeft < 0 ? 'Vencido' : daysLeft === 0 ? 'Vence hoy' : `En ${daysLeft} días`}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedStatement(stmt); }}
                        className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${styles.btn}`}
                      >
                        Pagar
                      </button>
                    </div>
                  </div>
                </div>
              );
            } else if (item.type === 'event') {
              const evt = item.data as any;
              const isIncome = evt.type === 'income' || evt.is_income;
              const category = categories.find(c => c.id === evt.category_id);
              const IconComponent = category ? ((LucideIcons as any)[category.icon_name] || LucideIcons.CalendarDays) : LucideIcons.CalendarDays;
              const daysLeft = calculateDaysLeft(item.dueDateStr);
              const styles = getCardStyles(daysLeft);

              return (
                <div
                  key={`event-${evt.id}:${evt.due_date}`}
                  className={`shrink-0 w-[250px] bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl snap-start overflow-hidden flex flex-col transition-colors ${styles.cardHover}`}
                >
                  <div className="p-4 flex items-center gap-3 border-b border-default-100 dark:border-border-subtle">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconWrap}`}>
                      <IconComponent size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {evt.title || evt.name || category?.name || 'Compromiso Recurrente'}
                      </span>
                      <span className="text-[11px] text-default-500 truncate">
                        {category?.name || 'Compromiso Agendado'} {item.dueDateStr ? `· ${new Date(item.dueDateStr.split('T')[0] + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    <span className={`text-3xl font-light tracking-tight ${isIncome ? 'text-[#17c964]' : 'text-[#f31260]'}`}>
                      {evt.goal_id && evt.contribution_type==='free' ? 'Monto a definir' : `${isIncome ? '+' : '-'}$${Number(evt.amount || 0).toLocaleString('es-CL')}`}
                    </span>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-medium px-3 py-1 rounded-full ${styles.tag}`}>
                        {daysLeft < 0 ? 'Vencido' : daysLeft === 0 ? 'Vence hoy' : `En ${daysLeft} días`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt as RecurringTemplate);
                        }}
                        className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${styles.btn}`}
                      >
                        {isIncome ? 'Cobrar' : 'Pagar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            } else {
              const tx = item.data as Transaction;
              const isIncome = tx.type === 'income';
              const isGoal = !!tx.goal_id;
              const goal = isGoal ? goals.find(g => g.id === tx.goal_id) : undefined;
              const category = categories.find(c => c.id === tx.category_id);
              const IconComponent = isGoal ? LucideIcons.Flag : (category ? (LucideIcons as any)[category.icon_name] || LucideIcons.ShoppingCart : LucideIcons.ShoppingCart);
              const daysLeft = calculateDaysLeft(tx.due_date);
              const styles = getCardStyles(daysLeft);

              return (
                <div
                  key={`tx-${tx.id}`}
                  className={`shrink-0 w-[250px] bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl snap-start overflow-hidden flex flex-col transition-colors ${styles.cardHover}`}
                >
                  <div className="p-4 flex items-center gap-3 border-b border-default-100 dark:border-border-subtle">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconWrap}`}>
                      <IconComponent size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {isGoal && goal ? goal.name : (tx.name || category?.name || 'Transacción')}
                      </span>
                      <span className="text-[11px] text-default-500 truncate">
                        {isGoal ? 'Meta de ahorro' : (category?.name || 'General')} {tx.due_date ? `· ${new Date(tx.due_date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    <span className={`text-3xl font-light tracking-tight ${isIncome ? 'text-[#17c964]' : (isGoal ? 'text-foreground' : 'text-[#f31260]')}`}>
                      {isIncome ? '+' : (isGoal ? '' : '-')}${tx.amount.toLocaleString('es-CL')}
                    </span>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-medium px-3 py-1 rounded-full ${styles.tag}`}>
                        {daysLeft < 0 ? 'Vencido' : daysLeft === 0 ? 'Vence hoy' : `En ${daysLeft} días`}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }}
                        className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${styles.btn}`}
                      >
                        {isGoal ? 'Aportar' : (isIncome ? 'Cobrar' : 'Pagar')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
      )}

      {selectedTx && (
        <PaymentValidationModalV3
          transaction={selectedTx}
          accounts={accounts}
          category={categories.find(c => c.id === selectedTx.category_id)}
          goals={goals}
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          onSuccess={() => {
            setHiddenTxIds(prev => new Set(prev).add(selectedTx.id));
            setSelectedTx(null);
          }}
        />
      )}

      {selectedStatement && (
        <BillingPaymentModalV3
          statement={selectedStatement}
          creditCard={creditCards.find(c => c.id === selectedStatement.credit_card_id)!}
          accounts={accounts}
          isOpen={!!selectedStatement}
          onClose={() => setSelectedStatement(null)}
          onSuccess={() => {
            setHiddenStmtIds(prev => new Set(prev).add(selectedStatement.id));
            setSelectedStatement(null);
          }}
        />
      )}

      {selectedEvent && (
        <AgendaPaymentModal
          event={selectedEvent}
          isPaying={isPaying}
          onClose={() => setSelectedEvent(null)}
          onPay={async (accountId, amount, savingsAccountId) => {
            const dueDate =
              (selectedEvent as any).due_date ||
              (() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String((selectedEvent as any).payment_day || now.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              })();
            await payCommitment({
              id: selectedEvent.id,
              occurrenceDate: dueDate,
              accountId,
              amount,
              savingsAccountId,
            });
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
