import { Goal } from "@/types";
import * as LucideIcons from "lucide-react";
import { Link } from 'react-router-dom';

import { useCalendarToday } from '../../hooks/useCalendarToday';
import { getGoalDaysRemaining, formatGoalDeadline } from '../../model/goalDeadline';

interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const today = useCalendarToday();
  const Icon = (LucideIcons as any)[goal.icon_name] || LucideIcons.Flag;

  const percentage = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
  const isCompleted = goal.target_amount > 0 && goal.current_amount >= goal.target_amount;
  const timeRemaining = formatGoalDeadline(getGoalDaysRemaining(goal.deadline_date, today));

  return (
    <Link to={`/planning?view=goal-detail&id=${goal.id}`} className="w-full block">
      <div className="bg-white dark:bg-surface-card hover:bg-default-50 dark:hover:bg-surface-card border border-transparent dark:border-border-subtle rounded-2xl p-5 flex flex-col gap-4 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer h-full">
        <div className="flex justify-between items-start">
          <div className="flex gap-3 items-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: goal.color }}
            >
              <Icon size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-base text-foreground line-clamp-1">{goal.name}</span>
              <span className="text-[10px] font-normal uppercase tracking-wider" style={{ color: goal.color }}>
                {isCompleted ? 'Completada' : (['Vencida', 'Vence hoy', 'Sin fecha'].includes(timeRemaining) ? timeRemaining : `Faltan ${timeRemaining}`)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="font-light tracking-tight text-xl text-foreground">${goal.current_amount.toLocaleString('es-CL')}</span>
            <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] font-normal">de ${goal.target_amount.toLocaleString('es-CL')}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full mt-auto pt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-normal text-[#5a5a72] dark:text-[#a0a0b8]">Progreso</span>
            <span className="text-xs font-medium text-foreground">{percentage}%</span>
          </div>
          <div className="w-full bg-default-100 dark:bg-surface-raised h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%`, backgroundColor: goal.color }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
