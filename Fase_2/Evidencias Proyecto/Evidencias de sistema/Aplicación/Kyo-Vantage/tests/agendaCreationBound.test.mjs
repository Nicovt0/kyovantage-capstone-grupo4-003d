import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getOccurrenceInDateRange, getOccurrencesInDateRange, recurringCreationDate, formatDateOnly } from '../src/modules/agenda/services/eventRepository.ts';

test('monthly and yearly recurrences do not create unpaid occurrences before registration',()=>{
  const monthly={frequency:'monthly',payment_day:10,created_at:'2026-10-19T15:00:00Z',next_due_date:'2026-11-10'};
  assert.equal(getOccurrenceInDateRange(monthly,'2026-09-01','2026-09-30'),null);
  assert.equal(getOccurrenceInDateRange(monthly,'2026-10-01','2026-10-31'),null);
  assert.equal(formatDateOnly(getOccurrenceInDateRange(monthly,'2026-11-01','2026-11-30')),'2026-11-10');
  const yearly={...monthly,frequency:'yearly',next_due_date:'2026-12-10'};
  assert.equal(getOccurrenceInDateRange(yearly,'2025-01-01','2025-12-31'),null);
  assert.equal(formatDateOnly(getOccurrenceInDateRange(yearly,'2026-01-01','2026-12-31')),'2026-12-10');
});

test('creation day, Santiago midnight, clamped cutoffs and edited due dates preserve valid history',()=>{
  assert.equal(recurringCreationDate({created_at:'2026-10-20T01:00:00Z'}),'2026-10-19');
  const item={frequency:'monthly',payment_day:30,created_at:'2027-02-28T15:00:00Z',next_due_date:'2027-06-30'};
  assert.deepEqual(getOccurrencesInDateRange(item,new Date(2027,1,28),new Date(2027,2,30,23)).map(formatDateOnly),['2027-02-28','2027-03-30']);
  assert.equal(formatDateOnly(getOccurrenceInDateRange({...item,frequency:'once',due_date:'2025-01-01'},'2025-01-01','2025-01-31')),'2025-01-01');
  assert.equal(getOccurrenceInDateRange({frequency:'monthly',payment_day:10,next_due_date:'2026-11-10'},'2026-10-01','2026-10-31'),null);
});

test('confirmed older receipts remain visible even when no pending occurrence can be generated',async()=>{
  const full=readFileSync(new URL('../src/modules/agenda/services/eventRepository.ts',import.meta.url),'utf8');
  const source=full.slice(full.indexOf('async function filterAndSortTemplatesForRange'),full.indexOf('let _hasStatusColumn')).replace('async function','export async function');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let payments=[{template_id:'template',occurrence_date:'2026-09-10',transaction_id:'confirmed'}];
  const exports={};vm.runInNewContext(output,{exports,getOccurrencesInDateRange,formatDateOnly,USE_MOCKS:false,createClient:()=>({from:()=>({select(){return this;},in(){return this;},gte(){return this;},lte:async()=>({data:payments,error:null})})})});
  const template={id:'template',frequency:'monthly',payment_day:10,created_at:'2026-10-19T15:00:00Z'};
  const range=[new Date(2026,8,1),new Date(2026,8,30)];
  const rows=await exports.filterAndSortTemplatesForRange([template],...range);
  assert.equal(rows.length,1);assert.equal(rows[0].status,'paid');assert.equal(rows[0].payment_transaction_id,'confirmed');
  payments=[];assert.equal((await exports.filterAndSortTemplatesForRange([template],...range)).length,0);
});
