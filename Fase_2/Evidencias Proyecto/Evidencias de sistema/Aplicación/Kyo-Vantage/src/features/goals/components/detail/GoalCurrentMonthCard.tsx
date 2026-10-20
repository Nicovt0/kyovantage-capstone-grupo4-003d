import { Goal, Transaction } from "@/types";
import { useMemo } from "react";
import { TrendingUp, Target } from "lucide-react";

interface GoalCurrentMonthCardProps {
  goal: Goal;
  transactions: Transaction[];
}

export function GoalCurrentMonthCard({ goal, transactions }: GoalCurrentMonthCardProps) {
  const { currentMonthActual, expectedAmount, remainingThisMonth, percentage } = useMemo(() => {
    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM

    // Sum transactions for current month
    const actual = transactions
      .filter(tx => tx.date.startsWith(currentMonthStr))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expected = goal.contribution_amount || 0;
    const remaining = Math.max(0, expected - actual);
    const perc = expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 0;

    return {
      currentMonthActual: actual,
      expectedAmount: expected,
      remainingThisMonth: remaining,
      percentage: perc
    };
  }, [transactions, goal.contribution_amount]);

  const isCompleted = currentMonthActual >= expectedAmount && expectedAmount > 0;

  // Si no hay meta de aporte mensual configurada, no mostramos nada
  if (expectedAmount === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-surface-card rounded-3xl p-6 border border-transparent dark:border-border-subtle shadow-sm relative overflow-hidden flex flex-col gap-4">
      {/* Decorative gradient */}
      <div className={`absolute top-0 left-0 w-1 bg-gradient-to-b ${isCompleted ? 'from-[#17c964] to-[#17c964]/10' : 'from-[#6d28d9] to-[#6d28d9]/10'} h-full`} />

      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCompleted ? 'bg-[#17c964]/10 text-[#17c964]' : 'bg-default-50 dark:bg-surface-card text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
              <TrendingUp size={20} />
           </div>
           <div className="flex flex-col">
             <span className="font-bold text-foreground">Aporte de este mes</span>
             <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Progreso mensual actual</span>
           </div>
        </div>
        <div className="flex flex-col items-end">
           <span className={`text-2xl font-black ${isCompleted ? 'text-[#17c964]' : 'text-foreground'}`}>
             ${currentMonthActual.toLocaleString('es-CL')}
           </span>
           <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] font-medium">
             de ${expectedAmount.toLocaleString('es-CL')}
           </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
         <div className="flex justify-between items-center text-xs font-bold">
            <span className={isCompleted ? 'text-[#17c964]' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}>
               {percentage}% Completado
            </span>
            <span className={isCompleted ? 'text-[#17c964]' : 'text-foreground'}>
               {isCompleted ? '¡Meta del mes cumplida!' : `Faltan $${remainingThisMonth.toLocaleString('es-CL')} este mes`}
            </span>
         </div>
         <div className="w-full h-3 bg-default-100 dark:bg-surface-raised rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-[#17c964]' : 'bg-brand-primary'}`}
              style={{ width: `${percentage}%` }}
            />
         </div>
      </div>
    </div>
  );
}
