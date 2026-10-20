import { Goal, Transaction } from "@/types";
import { useMemo } from "react";
import { Check, X, Minus, Star, Clock, CalendarDays } from "lucide-react";

interface GoalMonthlyTimelineProps {
  goal: Goal;
  transactions: Transaction[];
}

export function GoalMonthlyTimeline({ goal, transactions }: GoalMonthlyTimelineProps) {

  const expectedAmount = goal.contribution_amount || 0;

  const monthsData = useMemo(() => {
    if (expectedAmount === 0) return [];

    const start = new Date((goal.plan_start_date || goal.start_date).slice(0,10)+'T12:00:00');
    const deadline = new Date(goal.deadline_date.slice(0,10)+'T12:00:00');
    const now = new Date();

    const data = [];

    // Empezar desde el MES SIGUIENTE al de inicio (no el mes actual de creación)
    // Así, una meta de 1 mes solo muestra 1 cuota: la del mes de vencimiento
    let currentDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    // Iteramos hasta el mes del deadline (inclusive)
    while (
      currentDate.getFullYear() < deadline.getFullYear() ||
      (currentDate.getFullYear() === deadline.getFullYear() && currentDate.getMonth() <= deadline.getMonth())
    ) {
      const monthStr = currentDate.toISOString().slice(0, 7); // YYYY-MM

      const isFuture = currentDate.getFullYear() > now.getFullYear() ||
                       (currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() > now.getMonth());

      const monthTx = transactions.filter(tx => tx.date.startsWith(monthStr));
      const actual = monthTx.reduce((sum, tx) => sum + tx.amount, 0);

      let status: 'completed' | 'exceeded' | 'partial' | 'failed' | 'future' = 'future';

      if (!isFuture) {
        if (actual >= expectedAmount * 1.5) {
          status = 'exceeded';
        } else if (actual >= expectedAmount * 0.98) {
          status = 'completed';
        } else if (actual >= expectedAmount * 0.4) {
          status = 'partial';
        } else {
          status = 'failed';
        }
      }

      data.push({
        id: monthStr,
        label: currentDate.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }),
        actual,
        status
      });

      // Siguiente mes
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    return data;
  }, [goal.start_date, goal.plan_start_date, goal.deadline_date, transactions, expectedAmount]);

  if (expectedAmount === 0 || monthsData.length === 0) return null;

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'completed': return { icon: Check, color: 'text-[#17c964]', bg: 'bg-[#17c964]/10', border: 'border-[#17c964]' };
      case 'exceeded': return { icon: Star, color: 'text-[#6d28d9]', bg: 'bg-brand-primary/10', border: 'border-[#6d28d9]' };
      case 'partial': return { icon: Minus, color: 'text-[#f5a524]', bg: 'bg-[#f5a524]/10', border: 'border-[#f5a524]' };
      case 'failed': return { icon: X, color: 'text-[#f31260]', bg: 'bg-[#f31260]/10', border: 'border-[#f31260]' };
      case 'future': default: return { icon: Clock, color: 'text-[#5a5a72] dark:text-[#a0a0b8]', bg: 'bg-default-50 dark:bg-surface-card', border: 'border-border-subtle/30' };
    }
  };

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="flex flex-col">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <CalendarDays size={20} className="text-[#6d28d9]" /> Cumplimiento Mensual
        </h3>
        <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] mt-1">Historial de constancia en base a tu cuota de ${expectedAmount.toLocaleString('es-CL')}</span>
      </div>

      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl p-6 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-max pb-2">
          {monthsData.map((month) => {
            const config = getStatusConfig(month.status);
            const Icon = config.icon;

            return (
              <div
                key={month.id}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border w-24 shrink-0 transition-colors ${config.bg} ${config.border} ${month.status === 'future' ? 'opacity-60 border-dashed' : ''}`}
              >
                <div className={`mb-2 ${config.color}`}>
                  <Icon size={20} strokeWidth={3} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider text-center ${month.status === 'future' ? 'text-[#5a5a72] dark:text-[#a0a0b8]' : 'text-foreground'}`}>
                  {month.label}
                </span>
                {month.status !== 'future' && (
                  <span className={`text-xs font-black mt-1 ${config.color}`}>
                    ${(month.actual / 1000).toFixed(1)}k
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
