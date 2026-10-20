import { createClient } from '../../../utils/supabase/client.ts';
import { USE_MOCKS } from '../../../shared/lib/serviceConfig.ts';
import { goalsDb } from '../../../mockdata/goals.ts';
import { accountsDb } from '../../../mockdata/accounts.ts';
import { transactionsDb } from '../../../mockdata/transactions.ts';
import { projectGoalAgenda, type GoalOccurrence, type GoalReceipt } from '../model/goalAgenda.ts';
import type { RecurringTemplate } from '../../../types/index.ts';
const mockReceipts:GoalReceipt[]=[];
const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function mapGoalOccurrence(row:GoalOccurrence):RecurringTemplate {
  return {id:`goal:${row.goal_id}`,goal_id:row.goal_id,contribution_type:row.contribution_type,title:`Aporte a meta: ${row.title}`,name:`Aporte a meta: ${row.title}`,
    amount:Number(row.amount),expected_amount:Number(row.amount),frequency:'monthly',type:'expense',status:row.status,due_date:row.occurrence_date,
    payment_day:Number(row.occurrence_date.slice(8,10)),is_active:true,payment_transaction_id:row.transaction_id || undefined};
}
export async function getGoalAgendaOccurrences(start:Date,end:Date):Promise<RecurringTemplate[]> {
  if(USE_MOCKS) return projectGoalAgenda(goalsDb,mockReceipts,localDate(start),localDate(end),localDate(new Date())).map(mapGoalOccurrence);
  const {data,error}=await createClient().rpc('get_goal_agenda_occurrences',{p_start:localDate(start),p_end:localDate(end)});
  if(error) throw new Error(['PGRST202','42883'].includes(error.code) ? 'Staging necesita la migración 20261018000004_restore_original_tables.sql para mostrar los aportes en Agenda.' : error.message);
  return ((data || []) as GoalOccurrence[]).map(mapGoalOccurrence);
}
export async function payGoalOccurrence(input:{id:string;occurrenceDate:string;accountId:string;amount?:number;savingsAccountId?:string}):Promise<string> {
  const id=input.id.replace(/^goal:/,'');
  if(USE_MOCKS) {
    const month=input.occurrenceDate.slice(0,7)+'-01';
    const receipt=mockReceipts.find(r=>r.goal_id===id && r.occurrence_month===month);
    if(receipt) {
      if(receipt.account_id!==input.accountId || (receipt.savings_account_id || '')!==(input.savingsAccountId || '') || receipt.amount!==input.amount) throw new Error('El aporte de este mes ya está confirmado con otros datos.');
      return receipt.transaction_id;
    }
    const goal=goalsDb.find(g=>g.id===id);
    const event=projectGoalAgenda(goal ? [goal]:[],mockReceipts,month,input.occurrenceDate,localDate(new Date())).find(e=>e.occurrence_date===input.occurrenceDate);
    const amount=input.amount ?? event?.amount ?? 0;
    const account=accountsDb.find(a=>a.id===input.accountId);
    const destination=input.savingsAccountId ? accountsDb.find(a=>a.id===input.savingsAccountId) : undefined;
    if(!goal || !event || !Number.isFinite(amount) || amount<=0 || amount>goal.target_amount-goal.current_amount) throw new Error('Aporte o fecha inválidos.');
    if(goal.contribution_type!=='free' && amount!==event.amount) throw new Error('El aporte cambió según el plan. Actualiza Agenda.');
    if(!account || (account as {is_archived?:boolean}).is_archived || account.balance<amount) throw new Error('Cuenta inválida o saldo insuficiente.');
    if(input.savingsAccountId && (!destination || destination.id===account.id || (destination as {is_archived?:boolean}).is_archived)) throw new Error('Destino inválido.');
    const transactionId=crypto.randomUUID(); const group=destination ? crypto.randomUUID() : undefined;
    account.balance-=amount;account.current_balance=account.balance;goal.current_amount+=amount;
    transactionsDb.push({id:transactionId,account_id:account.id,goal_id:goal.id,type:'expense',amount,name:`Aporte a meta: ${goal.name}`,date:new Date().toISOString(),status:'paid',category_id:'',transfer_group_id:group,agenda_payment:true});
    if(destination) {destination.balance+=amount;destination.current_balance=destination.balance;transactionsDb.push({id:crypto.randomUUID(),account_id:destination.id,type:'income',amount,name:`Aporte a meta: ${goal.name} (Ahorro)`,date:new Date().toISOString(),status:'paid',category_id:'',transfer_group_id:group,agenda_payment:true});}
    mockReceipts.push({goal_id:id,occurrence_month:month,occurrence_date:input.occurrenceDate,amount,transaction_id:transactionId,account_id:account.id,savings_account_id:input.savingsAccountId});
    if(goal.contribution_type==='auto') {
      goal.contribution_amount=projectGoalAgenda([goal],mockReceipts,month,goal.deadline_date.slice(0,10),localDate(new Date())).find(row=>row.status!=='paid')?.amount || 0;
    }
    return transactionId;
  }
  const {data,error}=await createClient().rpc('pay_goal_occurrence',{p_goal_id:id,p_occurrence_date:input.occurrenceDate,p_account_id:input.accountId,p_amount:input.amount ?? null,p_savings_account_id:input.savingsAccountId || null});
  if(error) throw new Error(error.message || 'No se pudo confirmar el aporte.');
  if(!data) throw new Error('El servidor no confirmó el aporte.');
  return String(data);
}
