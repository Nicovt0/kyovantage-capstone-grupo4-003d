import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

interface GoalSummaryChartProps {
  totalTarget: number;
  totalCurrent: number;
}

export function GoalSummaryChart({ totalTarget, totalCurrent }: GoalSummaryChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totalRemaining = Math.max(0, totalTarget - totalCurrent);
  const isCompleted = totalCurrent >= totalTarget && totalTarget > 0;
  const globalPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;

  const chartData = useMemo(() => {
    if (totalTarget === 0) {
      return [{ name: 'Sin Metas', value: 1, color: 'rgba(109, 40, 217, 0.1)' }];
    }

    if (isCompleted) {
      return [
        { name: 'Ahorrado', value: totalCurrent, color: '#17c964' }
      ];
    }

    return [
      { name: 'Ahorrado', value: totalCurrent, color: '#6d28d9' },
      { name: 'Faltante', value: totalRemaining, color: 'rgba(109, 40, 217, 0.15)' }
    ];
  }, [totalTarget, totalCurrent, totalRemaining, isCompleted]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && payload[0].name !== 'Sin Metas') {
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl">
          <p className="font-medium text-sm mb-1 text-foreground">{payload[0].name}</p>
          <p className="text-kyo-lightPurple font-medium">
            ${payload[0].value.toLocaleString('es-CL')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full h-[250px] md:h-[300px] flex items-center justify-center">
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] md:text-xs uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] font-normal">
          Total Ahorrado
        </span>
        <span className="text-3xl md:text-4xl font-light tracking-tight text-foreground mt-1">
          ${totalCurrent.toLocaleString('es-CL')}
        </span>
        <span className="text-xs font-medium text-[#6d28d9] mt-2 bg-brand-primary/10 px-2 py-0.5 rounded-full">
          {globalPercentage}% del objetivo
        </span>
      </div>

      {mounted && (
        <PieChart width={300} height={250}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            stroke="none"
            paddingAngle={isCompleted || totalCurrent === 0 || totalTarget === 0 ? 0 : 4}
            cornerRadius={20}
            dataKey="value"
            isAnimationActive={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      )}
    </div>
  );
}
