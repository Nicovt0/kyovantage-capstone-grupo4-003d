import { parseDate } from '@internationalized/date';
export interface GoalAgendaPlan {
  id:string; name:string; target_amount:number; current_amount:number; start_date:string; deadline_date:string;
  contribution_type:'auto'|'fixed'|'free'; contribution_amount:number; plan_start_date?:string|null;
}
export interface GoalReceipt {goal_id:string;occurrence_date:string;occurrence_month:string;amount:number;transaction_id:string;account_id:string;savings_account_id?:string|null;}
export interface GoalOccurrence {goal_id:string;title:string;contribution_type:'auto'|'fixed'|'free';occurrence_date:string;amount:number;status:'paid'|'pending'|'overdue';transaction_id:string|null;}
export function projectGoalAgenda(goals:GoalAgendaPlan[],receipts:GoalReceipt[],start:string,end:string,today:string):GoalOccurrence[] {
  const events:GoalOccurrence[]=[];
  for(const goal of goals) {
    const anchor=parseDate((goal.plan_start_date || goal.start_date).slice(0,10));
    const deadline=parseDate(goal.deadline_date.slice(0,10));
    const due=(month:ReturnType<typeof parseDate>)=>month.set({day:Math.min(anchor.day,month.calendar.getDaysInMonth(month))});
    const first=anchor.set({day:1}).add({months:1});
    const reference=first.compare(parseDate(today).set({day:1}))>0 ? first : parseDate(today).set({day:1});
    const unpaid:ReturnType<typeof parseDate>[]=[];
    for(let month=reference;month.compare(deadline)<=0;month=month.add({months:1})) {
      if(due(month).compare(deadline)<=0 && !receipts.some(r=>r.goal_id===goal.id && r.occurrence_month===month.toString())) unpaid.push(month);
    }
    for(let month=parseDate(start).set({day:1});month.compare(parseDate(end))<=0;month=month.add({months:1})) {
      const paid=receipts.find(r=>r.goal_id===goal.id && r.occurrence_month===month.toString());
      if(paid) {
        if(paid.occurrence_date>=start && paid.occurrence_date<=end) events.push({goal_id:goal.id,title:goal.name,contribution_type:goal.contribution_type,occurrence_date:paid.occurrence_date,amount:paid.amount,status:'paid',transaction_id:paid.transaction_id});
        continue;
      }
      const date=due(month).toString(); const remaining=Math.max(0,goal.target_amount-goal.current_amount);
      if(month.compare(first)<0 || date<start || date>end || date>goal.deadline_date.slice(0,10) || remaining<=0) continue;
      const amount=goal.contribution_type==='free' ? 0 : goal.contribution_type==='fixed'
        ? Math.min(goal.contribution_amount,Math.max(0,remaining-unpaid.filter(m=>m.compare(month)<0).length*goal.contribution_amount))
        : Math.min(remaining,Math.ceil(remaining/Math.max(1,unpaid.length)));
      if(amount<=0 && goal.contribution_type!=='free') continue;
      events.push({goal_id:goal.id,title:goal.name,contribution_type:goal.contribution_type,occurrence_date:date,amount,status:date<today ? 'overdue':'pending',transaction_id:null});
    }
  }
  return events;
}
