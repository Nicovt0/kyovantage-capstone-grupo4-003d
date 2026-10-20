import { financialCycleForMonth, getFinancialCycle, isInFinancialCycle } from '../../../utils/financialCycle.ts';
import type { Transaction } from '@/types';

export interface FinancialMonth { year:number; month:number; }
export function resolveFinancialPeriod(selection:FinancialMonth|null,day:number,now=new Date()) {
  const current=getFinancialCycle(now,day);
  const cycle=selection ? financialCycleForMonth(selection.year,selection.month,day):current;
  const isCurrent=cycle.start.getTime()===current.start.getTime();
  return {cycle,isCurrent,referenceDate:isCurrent ? now:cycle.end};
}
export function shiftFinancialMonth(cycle:{start:Date},direction:number):FinancialMonth {
  const date=new Date(cycle.start.getFullYear(),cycle.start.getMonth()+direction,1);
  return {year:date.getFullYear(),month:date.getMonth()};
}
export function periodTransactions(transactions:Transaction[],cycle:{start:Date;nextStart:Date}) {
  return transactions.filter(tx=>tx.status!=='pending' && isInFinancialCycle(tx.date,cycle));
}
export function periodCashflow(transactions:Transaction[],cycle:{start:Date;nextStart:Date}) {
  let income=0;let expense=0;
  for(const tx of periodTransactions(transactions,cycle)) {
    if(tx.transfer_group_id || tx.type==='transfer' || tx.billing_payment)continue;
    if(tx.type==='income')income+=tx.amount;
    if(tx.type==='expense')expense+=tx.amount;
  }
  return {income,expense,surplus:income-expense};
}
