import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

interface BudgetSummaryChartProps {
  totalBudget: number;
  totalUsed: number;
}

export function BudgetSummaryChart({ totalBudget, totalUsed }: BudgetSummaryChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totalAvailable = Math.max(0, totalBudget - totalUsed);
  const isOverBudget = totalUsed > totalBudget;

  const chartData = useMemo(() => {
    if (totalBudget === 0) {
      return [{ name: 'Sin Presupuesto', value: 1, color: 'rgba(109, 40, 217, 0.1)' }];
    }

    if (isOverBudget) {
      return [
        { name: 'Excedido', value: totalUsed, color: '#f31260' }
      ];
    }

    return [
      { name: 'Gastado', value: totalUsed, color: '#6d28d9' },
      { name: 'Disponible', value: totalAvailable, color: 'rgba(109, 40, 217, 0.15)' }
    ];
  }, [totalBudget, totalUsed, totalAvailable, isOverBudget]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && payload[0].name !== 'Sin Presupuesto') {
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl">
          <p className="font-medium text-sm mb-1 text-foreground">{payload[0].name}</p>
          <p className={payload[0].name === 'Excedido' ? 'text-danger font-medium' : 'text-kyo-lightPurple font-medium'}>
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
          {isOverBudget ? 'Excedido por' : 'Disponible'}
        </span>
        <span
          className={`text-2xl md:text-3xl font-light tracking-tight max-w-[140px] truncate pointer-events-auto ${isOverBudget ? 'text-danger' : 'text-foreground'}`}
          title={`$${(isOverBudget ? (totalUsed - totalBudget) : totalAvailable).toLocaleString('es-CL')}`}
        >
          ${(isOverBudget ? (totalUsed - totalBudget) : totalAvailable).toLocaleString('es-CL')}
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
            paddingAngle={isOverBudget || totalUsed === 0 || totalBudget === 0 ? 0 : 4}
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
