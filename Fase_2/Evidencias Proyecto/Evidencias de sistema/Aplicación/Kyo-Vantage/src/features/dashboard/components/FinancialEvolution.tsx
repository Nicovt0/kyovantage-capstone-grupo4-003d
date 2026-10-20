import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import type { Transaction } from '@/types';
import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { buildFinancialEvolution } from '../model/financialEvolution';

const money=(value:number)=>'$'+value.toLocaleString('es-CL');
const compact=(value:number)=>new Intl.NumberFormat('es-CL',{notation:'compact',maximumFractionDigits:1}).format(value);
const green='var(--evolution-income)';const red='var(--evolution-expense)';

export function FinancialEvolution({transactions}:{transactions:Transaction[]}) {
  const {cycle}=useFinancialPeriod();
  const id=useId().replace(/:/g,'');
  const today=new Date();
  const todayKey=today.toDateString();
  const data=useMemo(()=>buildFinancialEvolution(transactions,cycle,new Date()),[transactions,cycle,todayKey]);
  const hasFuture=cycle.start>today;
  const chartMaximum=Math.max(data.income,data.expense,1)*1.12;
  return <section aria-label="Evolución financiera del período" className="min-w-0 overflow-hidden rounded-3xl border border-border-subtle bg-surface-card [--evolution-income:#15803d] dark:[--evolution-income:#34d399] [--evolution-expense:#e11d48] dark:[--evolution-expense:#fb7185]">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle p-4 sm:px-6">
      <div className="flex items-center gap-2"><ChartNoAxesCombined size={19} className="text-kyo-lightPurple"/><h2 className="font-semibold text-foreground">Tu evolución</h2></div>
    </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap gap-6">
          <div><p className="flex items-center gap-1 text-xs text-on-surface-card-secondary"><ArrowDownLeft size={14}/>Ingresos</p><strong className="text-emerald-700 dark:text-emerald-300">{money(data.income)}</strong></div>
          <div><p className="flex items-center gap-1 text-xs text-on-surface-card-secondary"><ArrowUpRight size={14}/>Gastos</p><strong className="text-rose-700 dark:text-rose-300">{money(data.expense)}</strong></div>
        </div>
      </div>
      <div role="img" aria-label={`Ingresos acumulados ${money(data.income)}, gastos acumulados ${money(data.expense)}`} className="h-60 min-w-0 px-2 pt-5 sm:px-4">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data.points} margin={{top:12,right:14,left:0,bottom:0}} accessibilityLayer>
            <defs><linearGradient id={`${id}-income`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={green} stopOpacity={0.17}/><stop offset="100%" stopColor={green} stopOpacity={0}/></linearGradient><linearGradient id={`${id}-expense`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={red} stopOpacity={0.2}/><stop offset="100%" stopColor={red} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 6"/>
            <XAxis dataKey="label" tick={{fill:'var(--on-surface-card-secondary)',fontSize:10}} tickLine={false} axisLine={false} minTickGap={55} interval="preserveStartEnd"/>
            <YAxis tickFormatter={compact} tick={{fill:'var(--on-surface-card-secondary)',fontSize:10}} tickLine={false} axisLine={false} width={48} domain={[0,chartMaximum]}/>
            <Tooltip formatter={(value:number,name:string)=>[money(value),name]} contentStyle={{background:'var(--surface-card)',border:'1px solid var(--border-subtle)',borderRadius:12,color:'var(--on-background)'}} labelStyle={{color:'var(--on-background)'}}/>
            <Area type="linear" dataKey="income" name="Ingresos acumulados" stroke={green} strokeWidth={2.5} fill={`url(#${id}-income)`} isAnimationActive={false}/>
            <Area type="linear" dataKey="expense" name="Gastos acumulados" stroke={red} strokeWidth={2.5} fill={`url(#${id}-expense)`} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3 sm:px-6">
        <p className="text-sm text-on-surface-card-secondary">Resultado del período: <strong className={data.net<0 ? 'text-rose-700 dark:text-rose-300':'text-emerald-700 dark:text-emerald-300'}>{money(data.net)}</strong></p>
      </div>
      <p className="px-4 pb-4 text-xs text-on-surface-card-secondary sm:px-6">{hasFuture ? 'Período futuro: todavía no hay movimientos realizados.' : data.income===0 && data.expense===0 ? 'Todavía no hay movimientos realizados en este período.' : 'Acumulado diario de movimientos realizados; los días futuros no se proyectan.'}</p>
  </section>;
}
