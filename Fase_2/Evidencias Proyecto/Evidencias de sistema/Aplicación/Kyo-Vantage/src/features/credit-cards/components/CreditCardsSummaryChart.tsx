import { CreditCard, Bank } from "@/types";
import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

interface CreditCardsSummaryChartProps {
  creditCards: CreditCard[];
  banks: Bank[];
}

export function CreditCardsSummaryChart({ creditCards, banks }: CreditCardsSummaryChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totalDebt = useMemo(() => {
    return creditCards.reduce((sum, card) => sum + (card.current_debt || 0), 0);
  }, [creditCards]);

  const chartData = useMemo(() => {
    return creditCards
      .filter(card => (card.current_debt || 0) > 0)
      .map(card => {
        const bank = banks.find(b => b.id === card.bank_id);
        return {
          name: card.name,
          value: card.current_debt || 0,
          color: bank?.color || '#6d28d9'
        };
      });
  }, [creditCards, banks]);

  // Si no hay deudas, mostramos un gráfico vacío en gris
  const dataToRender = chartData.length > 0 ? chartData : [{ name: 'Sin deuda', value: 1, color: '#f4f4f5' }];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && chartData.length > 0) {
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl">
          <p className="font-semibold text-sm mb-1 text-foreground">{payload[0].name}</p>
          <p className="text-kyo-lightPurple font-bold" style={{ color: payload[0].payload.color }}>
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
        <span className="text-[10px] md:text-xs uppercase tracking-widest text-[#f31260] font-bold">
          Deuda Total
        </span>
        <span className="text-2xl md:text-3xl font-black text-foreground">
          ${totalDebt.toLocaleString('es-CL')}
        </span>
      </div>

      {mounted && (
        <PieChart width={300} height={250}>
          <Pie
            data={dataToRender}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            stroke="none"
            paddingAngle={4}
            cornerRadius={20}
            dataKey="value"
          >
            {dataToRender.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      )}
    </div>
  );
}
