import { Transaction } from "@/types";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { Activity } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

interface CreditCardDetailChartsProps {
  transactions: Transaction[];
  color: string;
}

type TimeRange = '1W' | '1M' | '1Y';

export function CreditCardDetailCharts({ transactions, color }: CreditCardDetailChartsProps) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<TimeRange>('1M');

  useEffect(() => setMounted(true), []);

  const chartData = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (range === '1Y') {
      const monthlyExpenses = new Array(12).fill(0);
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === year) {
          monthlyExpenses[txDate.getMonth()] += tx.amount;
        }
      });
      const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      let accumulated = 0;
      return monthlyExpenses.map((spent, idx) => {
        accumulated += spent;
        return { label: monthsShort[idx], gasto: spent, acumulado: accumulated };
      });
    }

    if (range === '1W') {
      const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);

      const weekData = [];
      let acc = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        let dayTotal = 0;
        transactions.forEach(tx => {
          const txDate = new Date(tx.date);
          if (txDate.getDate() === d.getDate() && txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear()) {
            dayTotal += tx.amount;
          }
        });

        acc += dayTotal;
        weekData.push({
          label: DAYS_ES[d.getDay()],
          gasto: dayTotal,
          acumulado: acc
        });
      }
      return weekData;
    }

    // 1M logic
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyExpenses = new Array(daysInMonth).fill(0);

    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === month && txDate.getFullYear() === year) {
        dailyExpenses[txDate.getDate() - 1] += tx.amount;
      }
    });

    const data = [];
    let accumulated = 0;
    for (let i = 0; i < daysInMonth; i++) {
      accumulated += dailyExpenses[i];
      data.push({
        label: `${i + 1}`,
        gasto: dailyExpenses[i],
        acumulado: accumulated
      });
    }
    return data;
  }, [transactions, range]);

  const { totalGasto, maxGasto, avgGasto, periodLabel } = useMemo(() => {
    let total = 0;
    let max = 0;
    chartData.forEach(d => {
      total += d.gasto;
      if (d.gasto > max) max = d.gasto;
    });
    const avg = chartData.length > 0 ? total / chartData.length : 0;

    let label = '';
    if (range === '1W') label = 'ÚLTIMOS 7 DÍAS';
    else if (range === '1M') label = 'ESTE MES';
    else label = 'ESTE AÑO';

    return { totalGasto: total, maxGasto: max, avgGasto: avg, periodLabel: label };
  }, [chartData, range]);

  if (!mounted) return <div className="h-[300px] w-full animate-pulse bg-default-100 rounded-3xl" />;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const title = range === '1Y' ? label : `Día ${label}`;
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl text-xs z-50 relative">
          <p className="font-semibold text-foreground mb-1">{title}</p>
          <p className="font-bold text-foreground">
             Monto: ${val.toLocaleString('es-CL')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Activity size={20} className="text-[#6d28d9]" /> Análisis de Gastos
        </h3>

        <div className="flex bg-default-100 dark:bg-surface-card p-1 rounded-xl">
          {(['1W', '1M', '1Y'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                range === r
                  ? 'bg-white dark:bg-brand-primary text-foreground dark:text-white shadow-sm'
                  : 'text-[#5a5a72] dark:text-[#a0a0b8] hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">

        {/* Gráfico de Tendencia (Area) */}
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col">
            <h4 className="text-sm font-bold text-foreground">Tendencia de Gasto</h4>
            <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">
              Evolución de los gastos en el período seleccionado.
            </span>
          </div>
          <div className="w-full mt-2 overflow-x-auto pb-2">
            <div className="min-w-[600px] md:min-w-full h-[250px] pr-4">
              {mounted && (
                <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGastoArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.1)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#8E8E93' }}
                    tickMargin={10}
                    minTickGap={5}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#8E8E93' }}
                    tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke={color}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorGastoArea)"
                    isAnimationActive={true}
                  />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
