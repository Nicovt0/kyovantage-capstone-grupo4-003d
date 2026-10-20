import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { getFinancialCycle, financialCycleForMonth, isInFinancialCycle, cycleDays, parseFinancialDate } from '@/utils/financialCycle';
import { Transaction } from "@/types";
import { useMemo, useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

interface BudgetTrendChartProps {
  transactions: Transaction[];
  currentDate: Date;
  limit: number;
  range: '1W' | '1M' | '1Y';
  color: string;
}

export function BudgetTrendChart({ transactions, currentDate, limit, range, color }: BudgetTrendChartProps) {
  const { settings: { financial_cycle_start_day: cycleStartDay } } = useFinancialSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const chartData = useMemo(() => {
    const year = getFinancialCycle(currentDate, cycleStartDay).start.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    if (range === '1Y') {
      const monthlyExpenses = new Array(12).fill(0);
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const cycle = financialCycleForMonth(year, monthIndex, cycleStartDay);
        monthlyExpenses[monthIndex] = transactions.filter(tx => isInFinancialCycle(tx.date, cycle)).reduce((sum, tx) => sum + tx.amount, 0);
      }

      const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return monthlyExpenses.map((spent, idx) => ({
        label: monthsShort[idx],
        gasto: spent,
        limite: limit
      }));
    }

    const days = cycleDays(getFinancialCycle(currentDate, cycleStartDay));
    let accumulated = 0;
    const data = days.map(date => {
      const next = new Date(date); next.setDate(next.getDate() + 1);
      const rawDaily = transactions.filter(tx => isInFinancialCycle(tx.date, { start: date, nextStart: next })).reduce((sum, tx) => sum + tx.amount, 0);
      accumulated += rawDaily;
      return { label: date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }), gasto: accumulated, limite: limit, rawDaily };
    });

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
          const txDate = parseFinancialDate(tx.date);
          if (txDate.getDate() === d.getDate() && txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear()) {
            dayTotal += tx.amount;
          }
        });

        acc += dayTotal;
        weekData.push({
          label: DAYS_ES[d.getDay()],
          gasto: acc,
          limite: limit,
          rawDaily: dayTotal
        });
      }
      return weekData;
    }

    return data;
  }, [transactions, currentDate, limit, range, cycleStartDay]);

  if (!mounted) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const title = range === '1Y' ? label : `Día ${label}`;
      return (
        <div className="bg-white dark:bg-surface-card p-3 rounded-xl border border-default-200 dark:border-border-subtle shadow-xl text-xs">
          <p className="font-semibold text-foreground mb-1">{title}</p>
          <p className="font-bold" style={{ color: color }}>
            {range === '1Y' ? 'Gasto Total:' : 'Gasto Acumulado:'} ${val.toLocaleString('es-CL')}
          </p>
          <p className="text-[#5a5a72] dark:text-[#a0a0b8] mt-1">
            Límite: ${limit.toLocaleString('es-CL')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full overflow-x-auto pb-2 h-full">
      <div className="min-w-[600px] md:min-w-full h-full pr-4">
        {mounted && (
          <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
            <AreaChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
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

              <ReferenceLine y={limit} stroke="#f31260" strokeDasharray="3 3" label={{ position: 'top', value: 'Límite', fill: '#f31260', fontSize: 10 }} />

              <Area
                type="monotone"
                dataKey="gasto"
                stroke={color}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorGasto)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
