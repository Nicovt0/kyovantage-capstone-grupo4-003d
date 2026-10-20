import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { BudgetStats } from "@/utils/budgetEngine";
import { getBudgetTrafficLight } from "@/utils/budgetTrafficLight";

interface BudgetBarChartSummaryProps {
  budgetsWithStats: BudgetStats[];
  totalBudget: number;
  totalUsed: number;
  totalAvailable: number;
}

export function BudgetBarChartSummary({ budgetsWithStats, totalBudget, totalUsed, totalAvailable }: BudgetBarChartSummaryProps) {
  // Find maximum limit/spent to scale the chart
  const maxLimit = useMemo(() => {
    let max = 0;
    budgetsWithStats.forEach(b => {
      if (b.current_limit > max) max = b.current_limit;
      if (b.spent > max) max = b.spent;
    });
    return max > 0 ? max : 1;
  }, [budgetsWithStats]);

  // If there are no budgets, we shouldn't fail
  if (!budgetsWithStats || budgetsWithStats.length === 0) {
    return (
      <div className="w-full bg-surface-card rounded-3xl p-6 shadow-md flex flex-col gap-6 text-center text-on-surface-card-secondary">
        No hay presupuestos para mostrar
      </div>
    );
  }

  return (
    <div className="w-full bg-surface-card rounded-3xl p-5 md:p-7 shadow-lg flex flex-col gap-6 border border-border-subtle dark:border-border-subtle">
      {/* Chart Area */}
      <div className="flex items-end justify-center gap-4 md:gap-8 w-full h-[220px] mt-6 relative px-2">
        {budgetsWithStats.map((b) => {
          const limit = b.current_limit;
          const spent = b.spent;
          const trafficLight = getBudgetTrafficLight(spent, limit, b.alert_threshold);
          const isExceeded = spent > limit;
          const alertAmount = (limit * trafficLight.alertThreshold) / 100;
          const showAlertLine = b.alert_threshold == null || b.alert_threshold > 0;

          // Calculate heights relative to maxLimit (giving a 15% padding at the top for labels)
          const limitHeightPct = (limit / maxLimit) * 85;
          const spentHeightPct = Math.min((spent / maxLimit) * 85, 85);

          return (
            <div key={b.id} className="flex flex-col items-center justify-end h-full gap-2 relative w-12 md:w-16 group">
              {/* Value Above Bar */}
              <div
                className="absolute flex flex-col items-center w-full whitespace-nowrap z-30 transition-transform group-hover:-translate-y-1"
                style={{ bottom: `calc(${Math.max(limitHeightPct, spentHeightPct)}% + 12px)` }}
              >
                {isExceeded && (
                  <AlertTriangle size={14} className="text-rose-700 dark:text-[#f31260] mb-0.5 drop-shadow-sm" />
                )}
                <span className={`text-[11px] md:text-xs font-extrabold ${trafficLight.status === 'red' ? 'text-rose-700 dark:text-[#f31260]' : 'text-foreground'} dark:drop-shadow-md`}>
                  ${(isExceeded ? spent : limit).toLocaleString('es-CL')}
                </span>
              </div>

              {/* Bar Container */}
              <div className="relative w-10 md:w-12 flex flex-col justify-end items-center" style={{ height: '100%' }}>
                {/* Background limit bar follows the surface theme */}
                <div
                  className="absolute bottom-0 w-full bg-surface-raised rounded-t-xl"
                  style={{ height: `${limitHeightPct}%` }}
                />

                {/* Alert threshold line (Dashed) */}
                {limit > 0 && showAlertLine && (
                  <div
                    className="absolute w-[140%] border-t-[1.5px] border-dashed border-on-surface-card-secondary/60 z-20"
                    style={{ bottom: `${(alertAmount / maxLimit) * 85}%` }}
                    title={`Notificación anticipada: ${trafficLight.alertThreshold}%`}
                  />
                )}

                {/* Filled spent bar uses the shared fixed traffic-light bands. */}
                <div
                  className={`absolute bottom-0 w-full rounded-t-xl z-10 transition-all duration-500 shadow-[0_4px_10px_rgba(0,0,0,0.3)] ${trafficLight.barClassName}`}
                  style={{ height: `${spentHeightPct}%` }}
                >
                  {isExceeded && (
                    <div
                      className="absolute top-0 w-full h-5 rounded-t-xl opacity-90"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #f31260, #f31260 4px, #ff4d4d 4px, #ff4d4d 8px)'
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Category Name */}
              <span className="text-[10px] md:text-xs text-on-surface-card-secondary font-semibold truncate w-[120%] text-center mt-2">
                {b.category?.name || 'Categoría'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-2 md:gap-x-6 text-[11px] md:text-xs text-foreground font-medium mt-4">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#17c964] rounded-[3px]" />
          <span>En control (&lt;80%)</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#eab308] rounded-[3px]" />
          <span>Advertencia (80–100%)</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[#f31260] rounded-[3px]" />
          <span>Superado (&gt;100%)</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-3 md:w-4 border-t-[1.5px] border-dashed border-on-surface-card-secondary/60" />
          <span>Notificación anticipada configurada</span>
        </div>
      </div>

      <div className="w-full border-t border-border-subtle my-2" />

      {/* Summaries */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 w-full">
        <div className="flex flex-col gap-0.5 md:gap-1">
          <span className="text-on-surface-card-secondary text-[10px] md:text-xs font-semibold">Presupuesto total</span>
          <span className="text-foreground font-bold text-base md:text-xl tracking-tight">${totalBudget.toLocaleString('es-CL')}</span>
        </div>
        <div className="flex flex-col gap-0.5 md:gap-1">
          <span className="text-on-surface-card-secondary text-[10px] md:text-xs font-semibold">Gastado</span>
          <span className="text-foreground font-bold text-base md:text-xl tracking-tight">${totalUsed.toLocaleString('es-CL')}</span>
        </div>
        <div className="flex flex-col gap-0.5 md:gap-1">
          <span className="text-on-surface-card-secondary text-[10px] md:text-xs font-semibold">Disponible</span>
          <span className="text-emerald-700 dark:text-[#17c964] font-bold text-base md:text-xl tracking-tight">${totalAvailable.toLocaleString('es-CL')}</span>
        </div>
      </div>

    </div>
  );
}
