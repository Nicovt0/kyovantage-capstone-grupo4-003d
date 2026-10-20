import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Recharts from 'recharts';
import { financialCycleForMonth } from '../src/utils/financialCycle.ts';
import { buildFinancialEvolution } from '../src/features/dashboard/model/financialEvolution.ts';

const cycle=financialCycleForMonth(2026,10,2);
const row=(date,type,amount,extra={})=>({id:date,date,type,amount,category_id:'food',status:'paid',...extra});
test('daily evolution honors financial cutoff across two months',()=>{
  const rows=[row('2026-11-01','income',999),row('2026-11-02','income',100),row('2026-11-03','expense',20),row('2026-11-03','expense',10,{category_id:'transport'}),row('2026-12-01','expense',5),row('2026-12-02','expense',888)];
  const data=buildFinancialEvolution(rows,cycle,new Date(2026,11,5));
  assert.equal(data.points.length,30);assert.equal(data.points[0].income,100);assert.equal(data.points[1].expense,30);
  assert.equal(data.income,100);assert.equal(data.expense,35);assert.equal(data.net,65);
  assert.equal(data.points.at(-1).expense,35);
});
test('actual cashflow excludes transfers, bill settlements, pending, cancelled and future paid dates',()=>{
  const rows=[row('2026-11-04','expense',5),row('2026-11-04','expense',500,{transfer_group_id:'x'}),row('2026-11-04','income',500,{transfer_group_id:'x'}),row('2026-11-04','transfer',500),row('2026-11-04','expense',500,{billing_payment:true}),row('2026-11-04','expense',500,{status:'cancelled'}),row('2026-11-04','expense',500,{status:'pending'}),row('2026-11-20','expense',500)];
  const data=buildFinancialEvolution(rows,cycle,new Date(2026,10,10,9));
  assert.equal(data.expense,5);assert.equal(data.income,0);
  assert.equal(data.points[8].expense,5);assert.equal(data.points[9].expense,null);
});
test('date-only transactions today count before noon; future and empty periods are not forecasts',()=>{
  const data=buildFinancialEvolution([row('2026-11-10','income',100)],cycle,new Date(2026,10,10,8));
  assert.equal(data.income,100);
  const future=buildFinancialEvolution([],financialCycleForMonth(2027,1,31),new Date(2026,10,10));
  assert.equal(future.points.length,31);assert.equal(future.points.every(point=>point.expense===null),true);
  const empty=buildFinancialEvolution([],cycle,new Date(2026,11,5));assert.equal(empty.net,0);assert.equal(empty.points.every(point=>point.expense===0),true);
});

test('the real chart renders both accumulated curves and scales to the amounts instead of a 0–1 axis',()=>{
  const source=readFileSync(new URL('../src/features/dashboard/components/FinancialEvolution.tsx',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
  const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const icon=()=>null;const exports={};
  const data={income:10000,expense:22000,net:-12000,points:[{label:'6 oct',income:0,expense:0},{label:'7 oct',income:10000,expense:22000},{label:'8 oct',income:10000,expense:22000},{label:'9 oct',income:null,expense:null}]};
  vm.runInNewContext(output,{exports,require:()=>jsxRuntime,...Recharts,useId:()=>':test:',useMemo:fn=>fn(),useFinancialPeriod:()=>({cycle}),buildFinancialEvolution:()=>data,ArrowDownLeft:icon,ArrowUpRight:icon,ChartNoAxesCombined:icon});
  const tree=exports.FinancialEvolution({transactions:[]});
  function find(node,type) {if(!node || typeof node!=='object')return null;if(node.type===type)return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,type);if(found)return found;}return null;}
  const chart=find(tree,Recharts.AreaChart);
  assert.equal(find(chart,Recharts.YAxis).props.domain[1]>22000,true);
  const svg=renderToStaticMarkup(createElement(Recharts.AreaChart,{...chart.props,width:800,height:220}));
  assert.equal((svg.match(/class="recharts-curve recharts-area-curve"/g) || []).length,2);
  assert.match(svg,/stroke="var\(--evolution-income\)"/);
  assert.match(svg,/stroke="var\(--evolution-expense\)"/);
  assert.equal(svg.includes('Mis presupuestos'),false);
});
