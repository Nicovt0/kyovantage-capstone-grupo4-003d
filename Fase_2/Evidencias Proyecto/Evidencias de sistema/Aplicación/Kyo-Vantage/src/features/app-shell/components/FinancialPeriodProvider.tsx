import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { resolveFinancialPeriod, shiftFinancialMonth, type FinancialMonth } from '../model/financialPeriod';

type PeriodContext=ReturnType<typeof resolveFinancialPeriod> & {previous:()=>void;next:()=>void;reset:()=>void};
const FinancialPeriodContext=createContext<PeriodContext|null>(null);
export function FinancialPeriodProvider({children}:{children:ReactNode}) {
  const [selection,setSelection]=useState<FinancialMonth|null>(null);
  const {settings:{financial_cycle_start_day:day}}=useFinancialSettings();
  const period=resolveFinancialPeriod(selection,day);
  const startTime=period.cycle.start.getTime();
  const nextTime=period.cycle.nextStart.getTime();
  const value=useMemo(()=>({...resolveFinancialPeriod(selection,day),
    previous:()=>setSelection(shiftFinancialMonth({start:new Date(startTime)},-1)),
    next:()=>setSelection(shiftFinancialMonth({start:new Date(startTime)},1)),
    reset:()=>setSelection(null),
  }),[selection,day,startTime,nextTime]);
  return <FinancialPeriodContext.Provider value={value}>{children}</FinancialPeriodContext.Provider>;
}
export function useFinancialPeriod() {
  const context=useContext(FinancialPeriodContext);
  if(!context)throw new Error('El navegador financiero necesita FinancialPeriodProvider.');
  return context;
}
