import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import { resolveFinancialPeriod, shiftFinancialMonth, periodTransactions, periodCashflow } from '../src/features/app-shell/model/financialPeriod.ts';
import { calculateBudgetStats } from '../src/utils/budgetEngine.ts';

const now=new Date(2026,10,20,12);
const tx=(id,date,amount,type='expense',extra={})=>({id,date,amount,type,status:'paid',category_id:'food',name:id,...extra});

test('navigation respects cutoff, year boundaries, short months and return to current month',()=>{
  const current=resolveFinancialPeriod(null,31,now);
  assert.equal(current.cycle.start.getMonth(),9);
  let selected=resolveFinancialPeriod({year:2027,month:0},31,now);
  selected=resolveFinancialPeriod(shiftFinancialMonth(selected.cycle,1),31,now);
  assert.equal(selected.cycle.start.getDate(),28);
  selected=resolveFinancialPeriod(shiftFinancialMonth(selected.cycle,1),31,now);
  assert.equal(selected.cycle.start.getMonth(),2);assert.equal(selected.cycle.start.getDate(),31);
  const previous=resolveFinancialPeriod(shiftFinancialMonth(resolveFinancialPeriod({year:2027,month:0},2,now).cycle,-1),2,now);
  assert.equal(previous.cycle.start.getFullYear(),2026);assert.equal(previous.cycle.start.getMonth(),11);
  assert.equal(resolveFinancialPeriod(null,2,now).isCurrent,true);
  assert.equal(resolveFinancialPeriod({year:2026,month:10},2,now).referenceDate.getTime(),now.getTime());
  assert.equal(resolveFinancialPeriod({year:2026,month:9},2,now).referenceDate.getDate(),1);
});

test('shared provider keeps the chosen period for different consumers and resets to the current cycle',()=>{
  const source=readFileSync(new URL('../src/features/app-shell/components/FinancialPeriodProvider.tsx',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
  const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let state=null;let context;
  const exports={};vm.runInNewContext(output,{exports,require:()=>jsxRuntime,createContext:()=>({Provider:()=>null}),useContext:()=>context,useMemo:fn=>fn(),useState:()=>[state,value=>state=value],useFinancialSettings:()=>({settings:{financial_cycle_start_day:2}}),resolveFinancialPeriod:(selection,day)=>resolveFinancialPeriod(selection,day,now),shiftFinancialMonth});
  const render=()=>context=exports.FinancialPeriodProvider({children:null}).props.value;
  render().previous();render();
  const dashboard=exports.useFinancialPeriod();const wallet=exports.useFinancialPeriod();const planning=exports.useFinancialPeriod();
  assert.equal(dashboard.cycle.start.getMonth(),9);assert.equal(wallet.cycle.start.getTime(),dashboard.cycle.start.getTime());assert.equal(planning.isCurrent,false);
  context.next();render();assert.equal(context.isCurrent,true);
  context.previous();render();context.reset();render();assert.equal(context.isCurrent,true);assert.equal(state,null);
});

test('period movements and cashflow include both boundary months and exclude pending/transfers/card settlements',()=>{
  const cycle=resolveFinancialPeriod({year:2026,month:10},2,now).cycle;
  const rows=[tx('before','2026-11-01',999),tx('start','2026-11-02',100,'income'),tx('end','2026-12-01',25),tx('next','2026-12-02',888),tx('pending','2026-11-05',777,'expense',{status:'pending'}),tx('out','2026-11-07',40,'expense',{transfer_group_id:'pair'}),tx('in','2026-11-07',40,'income',{transfer_group_id:'pair'}),tx('bill','2026-11-08',50,'expense',{billing_payment:true})];
  assert.deepEqual(periodTransactions(rows,cycle).map(t=>t.id),['start','end','out','in','bill']);
  assert.deepEqual(periodCashflow(rows,cycle),{income:100,expense:25,surplus:75});
  assert.deepEqual(periodCashflow(rows,resolveFinancialPeriod({year:2025,month:0},2,now).cycle),{income:0,expense:0,surplus:0});
});

test('selected period recalculates budget spending and rollover using earlier history, with cutoff changes',()=>{
  const budget={id:'budget',category_id:'food',limit_amount:100,period:'monthly',start_date:'2026-10-02',recurrent:true,rollover:true,alert_threshold:80};
  const rows=[tx('oct','2026-10-15',30),tx('nov','2026-11-05',80),tx('dec','2026-12-01',10)];
  const period=resolveFinancialPeriod({year:2026,month:10},2,now);
  const [stat]=calculateBudgetStats([budget],rows,[],period.referenceDate,2);
  assert.equal(stat.spent,90);assert.equal(stat.current_limit,170);
  const next=resolveFinancialPeriod({year:2026,month:11},2,now);
  assert.equal(calculateBudgetStats([budget],rows,[],next.referenceDate,2)[0].spent,0);
  assert.equal(resolveFinancialPeriod({year:2026,month:10},6,now).cycle.start.getDate(),6);
});

function repository(responses) {
  const source=readFileSync(new URL('../src/features/wallet/api/transactionRepository.ts',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const calls=[];let index=0;
  const client={from:table=>({select(){return this;},order(){return this;},range:async(start,end)=>{calls.push([start,end]);return responses[index++];},or:async()=>({data:[],error:null})})};
  const exports={};vm.runInNewContext(output,{exports,USE_MOCKS:false,createClient:()=>client,console,Error});
  return {api:exports,calls};
}

test('history pagination handles server caps and preserves old movements without writes',async()=>{
  const {api,calls}=repository([{data:[tx('latest','2026-12-01',1),tx('middle','2026-11-01',2)],count:3},{data:[tx('old','2024-01-01',3)],count:3}]);
  const rows=await api.getTransactions();
  assert.equal(rows.length,3);assert.equal(rows[2].id,'old');assert.deepEqual(calls,[[0,499],[2,501]]);
});

test('failed or truncated historical requests throw instead of displaying an empty/partial month',async()=>{
  await assert.rejects(repository([{data:null,error:{message:'sin conexión'}}]).api.getTransactions(),/sin conexión/);
  await assert.rejects(repository([{data:[tx('one','2026-01-01',1)],count:2},{data:[],count:2}]).api.getTransactions(),/incompleto/);
});
