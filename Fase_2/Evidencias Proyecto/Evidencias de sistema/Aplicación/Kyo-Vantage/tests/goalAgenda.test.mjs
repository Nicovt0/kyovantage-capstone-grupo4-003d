import test from 'node:test';
import assert from 'node:assert/strict';
import {projectGoalAgenda} from '../src/features/goals/model/goalAgenda.ts';
import {mapGoalOccurrence} from '../src/features/goals/api/goalAgendaRepository.ts';
const goal={id:'g',name:'Goal',target_amount:250,current_amount:0,start_date:'2030-01-31',deadline_date:'2030-04-30',contribution_type:'fixed',contribution_amount:100};
const project=(g=goal,receipts=[],start='2030-01-01',end='2030-04-30')=>projectGoalAgenda([g],receipts,start,end,'2030-01-31');
test('goal agenda derives three installments, starting next month with a capped final installment',()=>{
  const rows=project();
  assert.deepEqual(rows.map(row=>[row.occurrence_date,row.amount]),[['2030-02-28',100],['2030-03-31',100],['2030-04-30',50]]);
  const event=mapGoalOccurrence(rows[0]);assert.equal(event.id,'goal:g');assert.equal(event.goal_id,'g');assert.equal(event.amount,100);
});
test('paid receipts replace projected commitments and survive completion or deadline edits',()=>{
  const receipt={goal_id:'g',occurrence_month:'2030-02-01',occurrence_date:'2030-02-28',amount:100,transaction_id:'tx',account_id:'a'};
  const rows=project({...goal,current_amount:100},[receipt]);
  assert.equal(rows.length,3);assert.equal(rows[0].status,'paid');assert.equal(rows[1].amount,100);assert.equal(rows[2].amount,50);
  const completed=project({...goal,current_amount:250,deadline_date:'2030-01-31'},[receipt]);
  assert.equal(completed.length,1);assert.equal(completed[0].transaction_id,'tx');
});
test('flexible goal commitments have no invented amount and automatic adapts to paid receipts',()=>{
  assert.ok(project({...goal,contribution_type:'free',contribution_amount:0}).every(row=>row.amount===0));
  const auto={...goal,target_amount:100,contribution_type:'auto',contribution_amount:34};
  assert.equal(project(auto)[0].amount,34);
  const receipt={goal_id:'g',occurrence_month:'2030-02-01',occurrence_date:'2030-02-28',amount:34,transaction_id:'tx',account_id:'a'};
  assert.equal(project({...auto,current_amount:34},[receipt])[1].amount,33);
});
test('a changed plan starts the next month of its new anchor, keeping original creation date',()=>{
  const rows=project({...goal,plan_start_date:'2030-03-10',deadline_date:'2030-05-10'},[],'2030-01-01','2030-05-31');
  assert.deepEqual(rows.map(row=>row.occurrence_date),['2030-04-10','2030-05-10']);
});
