import { cycleDays, isInFinancialCycle, parseFinancialDate } from '../../../utils/financialCycle.ts';
import type { Transaction } from '@/types';

export function buildFinancialEvolution(transactions:Transaction[],cycle:{start:Date;nextStart:Date},now=new Date()) {
  const daily=new Map<string,{income:number;expense:number}>();
  const key=(date:Date)=>`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  for(const tx of transactions) {
    if((tx.status && tx.status!=='paid') || tx.type==='transfer' || tx.transfer_group_id || tx.billing_payment || !isInFinancialCycle(tx.date,cycle))continue;
    const date=parseFinancialDate(tx.date);
    if(/^\d{4}-\d{2}-\d{2}$/.test(tx.date))date.setHours(0,0,0,0);
    if(date>now)continue;
    const item=daily.get(key(date)) || {income:0,expense:0};
    if(tx.type==='income')item.income+=tx.amount;
    if(tx.type==='expense')item.expense+=tx.amount;
    daily.set(key(date),item);
  }
  let income=0;let expense=0;
  const points=cycleDays(cycle).map(date=>{
    const day=daily.get(key(date));
    income+=day?.income || 0;expense+=day?.expense || 0;
    const future=date>now;
    return {date:date.getTime(),label:date.toLocaleDateString('es-CL',{day:'numeric',month:'short'}),income:future ? null:income,expense:future ? null:expense};
  });
  return {points,income,expense,net:income-expense};
}
