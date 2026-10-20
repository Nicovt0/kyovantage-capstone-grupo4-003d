import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGoalPlan } from '../src/features/goals/model/goalPlan.ts';
const input={target:100000,current:0,mode:'fixed',fixed:10000,deadline:'2027-04-18',baseDate:'2026-10-18'};
test('fixed contributions start next month and reach 100k in ten months',()=>{
  const plan=calculateGoalPlan(input);
  assert.equal(plan.months,10); assert.equal(plan.firstPayment,'2026-11-18');
  assert.equal(plan.deadline,'2027-08-18'); assert.equal(plan.monthly,10000);
});
test('initial savings and partial last payment shorten the fixed plan',()=>{
  const plan=calculateGoalPlan({...input,current:25000});
  assert.equal(plan.months,8);assert.equal(plan.deadline,'2027-06-18');assert.equal(plan.lastPayment,5000);
});
test('monthly dates clamp to end of month without overflowing or drifting',()=>{
  const plan=calculateGoalPlan({...input,target:30000,baseDate:'2027-01-31'});
  assert.equal(plan.firstPayment,'2027-02-28');assert.equal(plan.deadline,'2027-04-30');
  assert.equal(calculateGoalPlan({...input,target:10000,baseDate:'2028-01-31'}).deadline,'2028-02-29');
});
test('automatic payments use remaining capital and only installments before the deadline',()=>{
  const plan=calculateGoalPlan({...input,mode:'auto',current:10000,deadline:'2027-01-18'});
  assert.equal(plan.months,3);assert.equal(plan.monthly,30000);
  const earlier=calculateGoalPlan({...input,mode:'auto',deadline:'2027-01-17'});
  assert.equal(earlier.months,2);assert.equal(earlier.monthly,50000);
  const rounded=calculateGoalPlan({...input,mode:'auto',target:100,deadline:'2027-01-18'});
  assert.equal(rounded.monthly,34);assert.equal(rounded.lastPayment,32);
});
test('flexible has a deadline and no monthly amount or first scheduled payment',()=>{
  const plan=calculateGoalPlan({...input,mode:'free',fixed:0});
  assert.equal(plan.monthly,0);assert.equal(plan.firstPayment,null);assert.equal(plan.deadline,input.deadline);
});
test('invalid amounts, dates and automatic plans before next month are rejected',()=>{
  for(const overrides of [{target:0},{current:100001},{fixed:0},{fixed:NaN},{mode:'auto',deadline:'2026-10-30'},{mode:'free',deadline:'2026-02-30'},{mode:'free',deadline:'2026-10-17'}]) {
    assert.throws(()=>calculateGoalPlan({...input,...overrides}));
  }
});
test('an already reached goal needs no future payments',()=>{
  const plan=calculateGoalPlan({...input,current:100000});
  assert.equal(plan.monthly,0);assert.equal(plan.months,0);assert.equal(plan.firstPayment,null);
});
