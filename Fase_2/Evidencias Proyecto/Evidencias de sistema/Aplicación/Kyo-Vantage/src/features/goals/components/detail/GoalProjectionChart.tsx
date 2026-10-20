import { useMemo, useState, useEffect } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, ReferenceLine } from "recharts";
import { Goal } from "@/types";
import { LineChart as LineChartIcon } from "lucide-react";

interface GoalProjectionChartProps {
  goal: Goal;
}

export function GoalProjectionChart({ goal }: GoalProjectionChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const chartData = useMemo(() => {
    const [sy, sm, sd] = goal.start_date.split('T')[0].split('-').map(Number);
    const start = new Date(sy, sm - 1, 1);

    const [dy, dm, dd] = goal.deadline_date.split('T')[0].split('-').map(Number);
    const deadline = new Date(dy, dm - 1, 1);

    const now = new Date();

    const data = [];
    let cumulativeActual = 0;

    if (goal.contribution_type === 'auto') {
      const totalMonthsDiff = (deadline.getFullYear() - start.getFullYear()) * 12 + (deadline.getMonth() - start.getMonth());
      const totalMonths = Math.max(1, totalMonthsDiff);
      const monthlyExpected = goal.target_amount / totalMonths;
      const currentMonthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const monthlyActual = goal.current_amount / Math.max(1, currentMonthsDiff);

      let cumulativeExpected = 0;
      const points = totalMonths + 1;

      for(let i = 0; i < points; i++) {
        const pointDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthLabel = pointDate.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });

        let actualVal = null;
        const isPastMonth = pointDate.getFullYear() < now.getFullYear() || (pointDate.getFullYear() === now.getFullYear() && pointDate.getMonth() < now.getMonth());
        const isCurrentMonth = pointDate.getFullYear() === now.getFullYear() && pointDate.getMonth() === now.getMonth();

        if (isPastMonth) {
           cumulativeActual += monthlyActual;
           actualVal = Math.round(cumulativeActual);
        } else if (isCurrentMonth) {
           actualVal = goal.current_amount;
           cumulativeActual = goal.current_amount;
        }

        data.push({
          month: monthLabel,
          Esperado: Math.round(cumulativeExpected),
          Aportado: actualVal
        });
        cumulativeExpected += monthlyExpected;
      }
    } else if (goal.contribution_type === 'fixed') {
      const fixedMonthly = goal.contribution_amount || 0;
      const monthsToReach = fixedMonthly > 0 ? Math.ceil(goal.target_amount / fixedMonthly) : 1;
      const currentMonthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const monthlyActual = goal.current_amount / Math.max(1, currentMonthsDiff);

      let cumulativeExpected = 0;
      const points = monthsToReach + 1;

      for(let i = 0; i < points; i++) {
        const pointDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthLabel = pointDate.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });

        let actualVal = null;
        const isPastMonth = pointDate.getFullYear() < now.getFullYear() || (pointDate.getFullYear() === now.getFullYear() && pointDate.getMonth() < now.getMonth());
        const isCurrentMonth = pointDate.getFullYear() === now.getFullYear() && pointDate.getMonth() === now.getMonth();

        if (isPastMonth) {
           cumulativeActual += monthlyActual;
           actualVal = Math.round(cumulativeActual);
        } else if (isCurrentMonth) {
           actualVal = goal.current_amount;
           cumulativeActual = goal.current_amount;
        }

        data.push({
          month: monthLabel,
          Esperado: Math.round(Math.min(goal.target_amount, cumulativeExpected)),
          Aportado: actualVal
        });
        cumulativeExpected += fixedMonthly;
      }
    } else {
      const currentMonthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const monthlyActual = goal.current_amount / Math.max(1, currentMonthsDiff);
      const points = currentMonthsDiff + 1;

      for(let i = 0; i < points; i++) {
        const pointDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthLabel = pointDate.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });

        let actualVal = null;
        const isPastMonth = pointDate.getFullYear() < now.getFullYear() || (pointDate.getFullYear() === now.getFullYear() && pointDate.getMonth() < now.getMonth());
        const isCurrentMonth = pointDate.getFullYear() === now.getFullYear() && pointDate.getMonth() === now.getMonth();

        if (isPastMonth) {
           cumulativeActual += monthlyActual;
           actualVal = Math.round(cumulativeActual);
        } else if (isCurrentMonth) {
           actualVal = goal.current_amount;
           cumulativeActual = goal.current_amount;
        }

        data.push({
          month: monthLabel,
          Aportado: actualVal
        });
      }
    }

    return data;
  }, [goal]);

  if (!mounted) return null;

  const chartMinWidth = Math.max(600, chartData.length * 60);

  return (
    <div className="w-full bg-white dark:bg-surface-card rounded-3xl p-4 sm:p-6 border border-transparent dark:border-border-subtle shadow-sm flex flex-col gap-4">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <LineChartIcon size={20} className="text-[#6d28d9]" /> Análisis de Gastos
          </h3>
          <span className="text-xs font-light text-[#5a5a72] dark:text-[#a0a0b8] mt-1">Aporte ideal esperado vs tu aporte real</span>
        </div>
          <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }}></div>
                  <span className="text-[10px] font-medium text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Real</span>
               </div>
               {goal.contribution_type !== 'free' && (
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: goal.color, opacity: 0.5 }}></div>
                    <span className="text-[10px] font-medium text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider">Esperado</span>
                 </div>
               )}
            </div>
          </div>
       </div>
       <div className="w-full mt-2 overflow-x-auto pb-2 custom-scrollbar">
         <div style={{ minWidth: `${chartMinWidth}px` }} className="h-[250px] pr-4">
           <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
             <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.1)" />
                 <XAxis
                   dataKey="month"
                   axisLine={false}
                   tickLine={false}
                   tick={{ fontSize: 10, fill: '#8E8E93', fontWeight: 'normal' }}
                   dy={10}
                   minTickGap={5}
                 />
                 <YAxis
                   axisLine={false}
                   tickLine={false}
                   tick={{ fontSize: 10, fill: '#8E8E93', fontWeight: 'normal' }}
                   tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                 />
                 <Tooltip
                   contentStyle={{ backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid rgba(109, 40, 217, 0.3)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                   itemStyle={{ fontSize: '13px', fontWeight: 'medium' }}
                   formatter={(value: any) => `$${value.toLocaleString('es-CL')}`}
                   labelStyle={{ color: '#a0a0b8', marginBottom: '6px', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'medium' }}
                   cursor={{ stroke: goal.color, strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.2 }}
                 />
                 {goal.contribution_type !== 'free' && (
                   <Line
                     type="monotone"
                     dataKey="Esperado"
                     stroke={goal.color}
                     strokeWidth={2}
                     strokeDasharray="5 5"
                     dot={false}
                     activeDot={false}
                     opacity={0.5}
                     isAnimationActive={false}
                   />
                 )}
                 <Line
                   type="monotone"
                   dataKey="Aportado"
                   stroke={goal.color}
                   strokeWidth={4}
                   dot={{ r: 4, fill: goal.color, strokeWidth: 2, stroke: '#fff' }}
                   activeDot={{ r: 6, strokeWidth: 0 }}
                   connectNulls={false}
                 />
                 {goal.contribution_type === 'free' && (
                   <ReferenceLine y={goal.target_amount} stroke="#f31260" strokeDasharray="3 3" opacity={0.5} />
                 )}
               </LineChart>
             </ResponsiveContainer>
         </div>
       </div>
    </div>
  );
}
