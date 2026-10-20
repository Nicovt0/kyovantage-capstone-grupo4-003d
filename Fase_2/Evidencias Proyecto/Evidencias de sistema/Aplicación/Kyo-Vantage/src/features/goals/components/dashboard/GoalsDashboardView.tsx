import { Goal } from "@/types";
import { useMemo, useState } from "react";
import { GoalCard } from "./GoalCard";
import { Plus, Flag, PiggyBank, CalendarClock } from "lucide-react";

import { useCalendarToday } from '../../hooks/useCalendarToday';
import { getGoalDaysRemaining } from '../../model/goalDeadline';

interface GoalsDashboardViewProps {
  goals: Goal[];
  onAddGoal?: () => void;
}

export function GoalsDashboardView({ goals, onAddGoal }: GoalsDashboardViewProps) {
  const today = useCalendarToday();
  const [activeTab, setActiveTab] = useState<'activas' | 'logradas'>('activas');

  const { achievedGoals, activeGoals, inactiveGoals } = useMemo(() => {

    const achieved = (goals || []).filter(g => g.current_amount >= g.target_amount);
    const unachieved = (goals || []).filter(g => g.current_amount < g.target_amount);

    const active = unachieved.filter(g => (getGoalDaysRemaining(g.deadline_date, today) ?? 0) >= 0);
    const inactive = unachieved.filter(g => (getGoalDaysRemaining(g.deadline_date, today) ?? 0) < 0);

    return { achievedGoals: achieved, activeGoals: active, inactiveGoals: inactive };
  }, [goals, today]);

  // Global stats
  const { totalTarget, totalCurrent, totalMonthlyNeeded } = useMemo(() => {
    let tTarget = 0;
    let tCurrent = 0;
    let tMonthly = 0;

    (goals || []).forEach(g => {
      tTarget += g.target_amount || 0;
      tCurrent += g.current_amount || 0;
      tMonthly += g.contribution_amount || 0;
    });

    return {
      totalTarget: tTarget,
      totalCurrent: tCurrent,
      totalMonthlyNeeded: tMonthly
    };
  }, [goals]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in">
      {/* Resumen Global Visual (Nuevo Diseño) */}
      <div className="relative w-full bg-gradient-to-br from-white to-default-50 dark:from-surface-card dark:to-surface-card rounded-3xl p-6 shadow-md border border-transparent dark:border-border-subtle flex flex-col items-center overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 dark:bg-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#9333ea]/10 dark:bg-transparent rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col items-center w-full">
          <span className="text-sm font-bold text-[#5a5a72] dark:text-[#a0a0b8] mb-2 uppercase tracking-widest">Total ahorrado en metas</span>
          <span className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#6d28d9] to-[#9333ea] bg-clip-text text-transparent mb-1 drop-shadow-sm">
            ${totalCurrent.toLocaleString('es-CL')}
          </span>
          <span className="text-xs md:text-sm font-medium text-[#5a5a72] dark:text-[#a0a0b8] mb-6">
            de ${totalTarget.toLocaleString('es-CL')} en total
          </span>

          {/* Barra de progreso */}
          <div className="w-full h-3 bg-default-100 dark:bg-black/40 rounded-full mb-8 overflow-hidden shadow-inner border border-black/5 dark:border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#6d28d9] via-[#8b5cf6] to-[#d946ef] rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(109,40,217,0.5)]"
              style={{ width: `${Math.min(Math.max((totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0), 0), 100)}%` }}
            />
          </div>

          {/* 3 Columnas inferiores */}
          <div className="w-full grid grid-cols-3 gap-3">
            <div className="flex flex-col text-center bg-white/50 dark:bg-surface-card/50 backdrop-blur-sm p-3 rounded-2xl border border-black/5 dark:border-white/5">
              <span className="text-[10px] md:text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] mb-1 uppercase tracking-wider">Avance</span>
              <span className="text-base md:text-lg font-bold text-[#17c964]">
                {totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%
              </span>
            </div>
            <div className="flex flex-col text-center bg-white/50 dark:bg-surface-card/50 backdrop-blur-sm p-3 rounded-2xl border border-black/5 dark:border-white/5">
              <span className="text-[10px] md:text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] mb-1 uppercase tracking-wider">Esfuerzo</span>
              <span className="text-base md:text-lg font-bold text-[#f31260]">
                ${totalMonthlyNeeded.toLocaleString('es-CL')}
              </span>
            </div>
            <div className="flex flex-col text-center bg-white/50 dark:bg-surface-card/50 backdrop-blur-sm p-3 rounded-2xl border border-black/5 dark:border-white/5">
              <span className="text-[10px] md:text-xs font-bold text-[#5a5a72] dark:text-[#a0a0b8] mb-1 uppercase tracking-wider">Activas</span>
              <span className="text-base md:text-lg font-bold text-[#006FEE]">
                {activeGoals.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full gap-3 mt-2">
        <button
          onClick={() => setActiveTab('activas')}
          className={`flex-1 flex flex-col justify-center items-center py-4 px-2 rounded-2xl border transition-all ${
            activeTab === 'activas'
              ? 'bg-brand-primary/10 border-[#6d28d9] shadow-sm'
              : 'bg-white dark:bg-surface-card border-transparent dark:border-border-subtle shadow-sm hover:border-[#6d28d9]/50'
          }`}
        >
          <span className={`text-xs font-medium tracking-widest uppercase ${activeTab === 'activas' ? 'text-[#6d28d9]' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
            Activas
          </span>
        </button>
        <button
          onClick={() => setActiveTab('logradas')}
          className={`flex-1 flex flex-col justify-center items-center py-4 px-2 rounded-2xl border transition-all ${
            activeTab === 'logradas'
              ? 'bg-brand-primary/10 border-[#6d28d9] shadow-sm'
              : 'bg-white dark:bg-surface-card border-transparent dark:border-border-subtle shadow-sm hover:border-[#6d28d9]/50'
          }`}
        >
          <span className={`text-xs font-medium tracking-widest uppercase ${activeTab === 'logradas' ? 'text-[#6d28d9]' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
            Logradas
          </span>
        </button>
      </div>

      {/* Sección Inferior: Lista de Metas */}
      {activeTab === 'activas' ? (
        <div className="flex flex-col gap-4 mt-2">
          {/* Activas */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag size={20} className="text-[#6d28d9]" />
              <h3 className="text-lg font-medium text-foreground">Metas en progreso</h3>
            </div>
            <div className="text-sm font-medium text-foreground bg-default-100 dark:bg-surface-card px-3 py-1 rounded-full">
              {activeGoals.length}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} />
            ))}

            <button
              type="button"
              onClick={onAddGoal}
              className="flex-1 min-h-[160px] bg-transparent border-2 border-dashed border-border-subtle/20 dark:border-border-subtle rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-default-50 dark:hover:bg-surface-card transition-colors cursor-pointer text-[#5a5a72] hover:text-foreground text-left w-full"
            >
              <div className="w-14 h-14 rounded-full bg-default-100 dark:bg-surface-raised flex items-center justify-center text-[#5a5a72] dark:text-[#a0a0b8]">
                <Plus size={28} />
              </div>
              <span className="font-medium text-sm">Crear Nueva Meta</span>
            </button>
          </div>

          {/* Inactivas/Vencidas */}
          {inactiveGoals.length > 0 && (
            <div className="flex flex-col gap-4 mt-6">
              <div className="flex items-center justify-between opacity-80">
                <div className="flex items-center gap-2">
                  <CalendarClock size={20} className="text-[#f5a524]" />
                  <h3 className="text-lg font-medium text-foreground">Inactivas / Vencidas</h3>
                </div>
                <div className="text-sm font-medium text-foreground bg-default-100 dark:bg-surface-card px-3 py-1 rounded-full">
                  {inactiveGoals.length}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80">
                {inactiveGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-2">
          {/* Logradas */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank size={20} className="text-[#17c964]" />
              <h3 className="text-lg font-medium text-foreground">Metas logradas</h3>
            </div>
            <div className="text-sm font-medium text-foreground bg-default-100 dark:bg-surface-card px-3 py-1 rounded-full">
              {achievedGoals.length}
            </div>
          </div>
          {achievedGoals.length === 0 ? (
             <div className="p-8 text-center text-[#5a5a72] dark:text-[#a0a0b8] text-sm font-medium bg-white dark:bg-surface-card rounded-3xl border border-transparent dark:border-border-subtle">
               Aún no tienes metas logradas. ¡Sigue ahorrando para alcanzar tus objetivos!
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {achievedGoals.map(goal => (
                 <GoalCard key={goal.id} goal={goal} />
               ))}
             </div>
          )}
        </div>
      )}
    </div>
  );
}
