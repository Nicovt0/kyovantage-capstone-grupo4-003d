import { Goal, Transaction, Category, Account } from "@/types";
import { useState } from "react";
import * as LucideIcons from "lucide-react";
import { GoalProjectionChart } from "./GoalProjectionChart";
import { GoalCurrentMonthCard } from "./GoalCurrentMonthCard";
import { GoalMonthlyTimeline } from "./GoalMonthlyTimeline";
import { Button } from "@heroui/react";
import { Edit2, Trash2, Target, Clock, X, ArrowRightLeft } from "lucide-react";
import { TransactionDetailModal } from "@/features/wallet/components/transactions/TransactionDetailModal";
import { GoalEditModal } from "@/features/goals/components/detail/GoalEditModal";
import { GoalDeleteModal } from "@/features/goals/components/detail/GoalDeleteModal";

import { useCalendarToday } from '../../hooks/useCalendarToday';
import { getGoalDaysRemaining, formatGoalDeadline } from '../../model/goalDeadline';

interface GoalDetailViewProps {
  goal: Goal;
  transactions?: Transaction[];
  categories?: Category[];
  accounts?: Account[];
}

export function GoalDetailView({ goal, transactions = [], categories = [], accounts = [] }: GoalDetailViewProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const Icon = (LucideIcons as any)[goal.icon_name] || LucideIcons.Flag;

  const percentage = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;

  const today = useCalendarToday();
  const deadlineLabel = formatGoalDeadline(getGoalDaysRemaining(goal.deadline_date, today));

  const radius = 64;
  const cx = 72;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const goalTransactions = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-28">

      {/* Header Compacto (Nuevo Diseño) */}
      <div className="w-full bg-white dark:bg-surface-card rounded-3xl shadow-sm border border-transparent dark:border-border-subtle flex flex-col relative overflow-hidden">

        {/* Top Section */}
        <div className="flex flex-row items-center gap-4 p-5 md:p-6 w-full">
          {/* Icon */}
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: goal.color }}
          >
            <Icon size={32} />
          </div>

          {/* Info */}
          <div className="flex flex-col flex-1 gap-1 min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full lowercase tracking-wide whitespace-nowrap"
                style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
              >
                prioridad {goal.priority === 'high' ? 'alta' : goal.priority === 'mid' ? 'media' : 'baja'}
              </span>
              <span className="text-[10px] md:text-xs text-[#5a5a72] dark:text-[#a0a0b8] lowercase whitespace-nowrap">
                aporte {goal.contribution_type === 'auto' ? 'automático' : goal.contribution_type === 'fixed' ? 'fijo' : 'libre'}
              </span>
            </div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground leading-tight">
              {goal.name}
            </h1>
          </div>

          {/* Buttons */}
          <div className="flex flex-row gap-2 self-start flex-shrink-0 mt-1">
            <Button size="sm" isIconOnly variant="ghost" className="bg-default-100 dark:bg-surface-raised text-default-600 hover:text-foreground border-transparent rounded-full" onPress={() => setIsEditOpen(true)}>
              <Edit2 size={16} />
            </Button>
            <Button size="sm" isIconOnly variant="ghost" className="bg-danger/10 hover:bg-danger/20 text-danger border-transparent rounded-full" onPress={() => setIsDeleteOpen(true)}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        {/* Separator */}
        <div className="w-[calc(100%-2.5rem)] mx-auto h-[1px] bg-black/5 dark:bg-white/5" />

        {/* Bottom Section */}
        <div className="grid grid-cols-3 p-4 md:p-6">
          <div className="flex flex-col items-center justify-center text-center gap-1 border-r border-black/5 dark:border-white/5">
            <Target size={18} className="text-[#5a5a72] dark:text-[#a0a0b8]" />
            <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] lowercase">objetivo</span>
            <span className="text-sm md:text-lg font-bold text-foreground">${goal.target_amount.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1 border-r border-black/5 dark:border-white/5">
            <Icon size={18} style={{ color: goal.color }} />
            <span className="text-[10px] md:text-xs font-medium lowercase" style={{ color: goal.color }}>ahorrado ({percentage}%)</span>
            <span className="text-sm md:text-lg font-bold text-foreground">${goal.current_amount.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-1">
            <Clock size={18} className="text-[#f5a524]" />
            <span className="text-[10px] md:text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] lowercase">restante</span>
            <span className="text-sm md:text-lg font-bold text-foreground">
              {deadlineLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <GoalProjectionChart
         goal={goal}
      />

      {/* Progreso del Mes Actual */}
      <GoalCurrentMonthCard goal={goal} transactions={goalTransactions} />

      {/* Timeline de Cumplimiento */}
      <GoalMonthlyTimeline goal={goal} transactions={goalTransactions} />

      {/* Historial de Aportes */}
      <div className="flex flex-col gap-4 mt-2">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ArrowRightLeft size={20} className="text-[#6d28d9]" /> Últimos Movimientos
        </h3>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle shadow-sm rounded-3xl overflow-hidden flex flex-col p-2 gap-1">
          {goalTransactions.length === 0 ? (
            <div className="p-8 text-center text-[#5a5a72] dark:text-[#a0a0b8] text-sm font-medium">
              Aún no hay aportes registrados para esta meta.
            </div>
          ) : (
            goalTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center p-3 hover:bg-default-50 dark:hover:bg-surface-card rounded-xl transition-colors cursor-pointer border border-transparent dark:hover:border-[#6d28d9]/30"
                onClick={() => setSelectedTx(tx)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                  >
                    <Icon size={18} />
                  </div>

                  <div className="flex flex-col">
                    <span className="font-bold text-[15px] text-foreground">{tx.name || 'Aporte'}</span>
                    <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">
                      {new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(tx.date))}
                    </span>
                  </div>
                </div>
                <span className="font-bold text-[15px] text-[#17c964]">
                  +${tx.amount.toLocaleString('es-CL')}
                </span>
              </div>
            ))
          )}
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

      <GoalEditModal
        goal={goal}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      <GoalDeleteModal
        goal={goal}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
      />

    </div>
  );
}
