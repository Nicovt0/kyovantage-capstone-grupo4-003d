import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const U = '10000000-0000-0000-0000-000000000001';
const OTHER = '10000000-0000-0000-0000-000000000002';
const A = '20000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000002';
const FOREIGN = '20000000-0000-0000-0000-000000000003';
const GOAL = '30000000-0000-0000-0000-000000000001';
const CARD = '40000000-0000-0000-0000-000000000001';
let db;
async function setup(legacyShape = false, restore = true, goalAgenda = true) {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(readFileSync(new URL('../supabase/schema-staging.sql', import.meta.url), 'utf8'));
  if (legacyShape) await db.exec(`alter table public.accounts drop column created_at;
    alter table public.transactions drop column created_at; alter table public.credit_card_ledger drop column created_at;
    alter table public.credit_cards drop column is_archived;`);
  const agenda = readFileSync(new URL('../supabase/migrations/20261005000048_agenda_occurrence_payments.sql', import.meta.url), 'utf8');
  await db.exec(agenda.slice(agenda.indexOf('create or replace function')));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261008000000_transaction_accounting_trigger.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261018000000_atomic_accounting.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261018000001_active_account_limit.sql', import.meta.url), 'utf8'));
  if (goalAgenda) await db.exec(readFileSync(new URL('../supabase/migrations/20261018000002_goal_contribution_plans.sql', import.meta.url), 'utf8'));
  if (goalAgenda) await db.exec(readFileSync(new URL('../supabase/migrations/20261018000003_goal_agenda.sql', import.meta.url), 'utf8'));
  if (restore) await db.exec(readFileSync(new URL('../supabase/migrations/20261018000004_restore_original_tables.sql', import.meta.url), 'utf8'));
  if (restore) await db.exec(readFileSync(new URL('../supabase/migrations/20261018000005_remove_account_limit.sql', import.meta.url), 'utf8'));
  if (restore) await db.exec(readFileSync(new URL('../supabase/migrations/20261019000002_goal_savings_account.sql', import.meta.url), 'utf8'));
}
async function reset() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);
    truncate public.agenda_occurrence_payments,
      public.transactions,public.credit_card_ledger,public.billing_statements,public.recurring_templates,public.accounts,public.credit_cards,public.goals,auth.users cascade;
    insert into auth.users values('${U}'),('${OTHER}');
    insert into public.accounts(id,user_id,name,type,balance) values
      ('${A}','${U}','Checking','cash',1000),('${B}','${U}','Savings','savings',500),('${FOREIGN}','${OTHER}','Foreign','cash',900);
    insert into public.goals(id,user_id,name,target_amount,current_amount) values('${GOAL}','${U}','Goal',10000,0);
    insert into public.credit_cards(id,user_id,name,card_network,total_limit,current_debt,billing_date,payment_date)
      values('${CARD}','${U}','Card','visa',10000,0,15,5);
    grant select,insert,update,delete on public.accounts,public.goals,public.credit_cards,public.billing_statements,public.recurring_templates,public.categories to authenticated;
    grant select on public.transactions,public.credit_card_ledger to authenticated;
    select set_config('request.jwt.claim.sub','${U}',false); set role authenticated;`);
}
async function rpc(op, payload, key = randomUUID()) {
  return (await db.query('select public.accounting_mutate($1,$2::jsonb,$3::uuid) as result', [op, JSON.stringify(payload), key])).rows[0].result;
}
async function balance(id=A) { return Number((await db.query('select balance from public.accounts where id=$1',[id])).rows[0].balance); }
async function goal() { return Number((await db.query('select current_amount from public.goals where id=$1',[GOAL])).rows[0].current_amount); }
async function debt() { return Number((await db.query('select current_debt from public.credit_cards where id=$1',[CARD])).rows[0].current_debt); }
const tx = extra => ({ account_id:A,type:'expense',amount:100,name:'Test',status:'paid',date:'2026-10-10T12:00:00Z',...extra });

test('PostgreSQL atomic accounting', async t => {
  try {
    await setup();
    await t.test('posted income, edit, account change, cancellation and deletion apply net effects once', async () => {
      await reset();
      const row = await rpc('create_transaction',tx({type:'income',amount:200}));
      assert.equal(await balance(),1200);
      await rpc('update_transaction',{id:row.id,updates:{amount:300}});
      assert.equal(await balance(),1300);
      await rpc('update_transaction',{id:row.id,updates:{account_id:B}});
      assert.equal(await balance(),1000); assert.equal(await balance(B),800);
      await rpc('update_transaction',{id:row.id,updates:{status:'pending'}});
      assert.equal(await balance(B),500);
      await rpc('delete_transaction',{id:row.id});
      assert.equal(await balance(B),500);
      const equal = (await db.query('select bool_and(balance=current_balance) as valid from public.accounts')).rows[0].valid;
      assert.equal(equal,true);
    });
    await t.test('transfer and goal contribution are atomic, count once, edit both legs and fully reverse', async () => {
      await reset();
      const row=await rpc('create_transaction',tx({type:'transfer',destination_account_id:B,goal_id:GOAL}));
      assert.equal(await balance(),900); assert.equal(await balance(B),600); assert.equal(await goal(),100);
      await rpc('update_transaction',{id:row.id,updates:{amount:150}});
      assert.equal(await balance(),850); assert.equal(await balance(B),650); assert.equal(await goal(),150);
      await rpc('delete_transaction',{id:row.id});
      assert.equal(await balance(),1000); assert.equal(await balance(B),500); assert.equal(await goal(),0);
      assert.equal((await db.query('select count(*)::int as n from public.transactions')).rows[0].n,0);
    });
    await t.test('foreign destination or insufficient funds rolls back both transfer legs and request record', async () => {
      await reset();
      await assert.rejects(rpc('create_transaction',tx({destination_account_id:FOREIGN})),/propia activa/);
      await assert.rejects(rpc('create_transaction',tx({amount:2000,destination_account_id:B})),/Saldo insuficiente/);
      assert.equal(await balance(),1000); assert.equal(await balance(B),500);
      assert.equal((await db.query('select count(*)::int as n from public.transactions')).rows[0].n,0);
    });
    await t.test('same request retries return the same result; a reused key with different content is rejected', async () => {
      await reset(); const key=randomUUID();
      const first=await rpc('create_transaction',tx(),key);
      const retry=await rpc('create_transaction',tx(),key);
      assert.equal(first.id,retry.id); assert.equal(await balance(),900);
      await assert.rejects(rpc('create_transaction',tx({amount:200}),key),/otra operación/);
      assert.equal(await balance(),900);
    });
    await t.test('more than five accounts can be created while archival preserves balance and history', async () => {
      await reset();
      for (let i=0;i<3;i++) await rpc('create_account',{name:`Extra ${i}`,type:'cash',balance:21});
      await rpc('create_account',{name:'Sixth',type:'cash',balance:0});
      const archived=(await db.query("select id from public.accounts where name='Extra 0'")).rows[0].id;
      await rpc('archive_account',{id:archived});
      const stored=(await db.query('select balance,is_archived,include_in_total from public.accounts where id=$1',[archived])).rows[0];
      assert.equal(Number(stored.balance),21); assert.equal(stored.is_archived,true); assert.equal(stored.include_in_total,false);
      assert.equal((await db.query('select count(*)::int as n from public.transactions where account_id=$1',[archived])).rows[0].n,1);
      await rpc('create_account',{name:'Replacement',type:'cash',balance:10});
      await rpc('create_account',{name:'Overflow',type:'cash',balance:0});
      assert.equal((await db.query('select count(*)::int as n from public.accounts where user_id=$1 and not coalesce(is_archived,false)', [U])).rows[0].n, 7);
      await assert.rejects(rpc('create_account',{name:'Sixth',type:'cash',balance:0}), /Ya existe/);
    });
    await t.test('opening balance is represented by one income and is not doubled', async () => {
      await reset();
      const row=await rpc('create_account',{name:'Opening',type:'cash',balance:300});
      assert.equal(Number(row.balance),300); assert.equal(Number(row.current_balance),300);
      const rows=(await db.query('select amount from public.transactions where account_id=$1',[row.id])).rows;
      assert.equal(rows.length,1); assert.equal(Number(rows[0].amount),300);
    });
    await t.test('goal confirmation adds the savings leg only once even with a fresh retry key', async () => {
      await reset();
      const pending=await rpc('create_transaction',tx({goal_id:GOAL,status:'pending'}));
      assert.equal(await balance(),1000); assert.equal(await goal(),0);
      await rpc('confirm_pending',{id:pending.id,savings_account_id:B,updates:{account_id:A}});
      await rpc('confirm_pending',{id:pending.id,savings_account_id:B,updates:{account_id:A}});
      assert.equal(await balance(),900); assert.equal(await balance(B),600); assert.equal(await goal(),100);
      await assert.rejects(rpc('confirm_pending',{id:pending.id,savings_account_id:B,updates:{account_id:A,amount:200}}),/confirmado con otros datos/);
    });
    await t.test('confirmed goal with an invalid savings destination rolls back the confirmation', async () => {
      await reset(); const pending=await rpc('create_transaction',tx({goal_id:GOAL,status:'pending'}));
      await assert.rejects(rpc('confirm_pending',{id:pending.id,savings_account_id:FOREIGN,updates:{account_id:A}}),/propia activa/);
      assert.equal(await balance(),1000); assert.equal(await goal(),0);
      assert.equal((await db.query('select status from public.transactions where id=$1',[pending.id])).rows[0].status,'pending');
    });
    await t.test('Agenda has one function overload, debits once and protects its receipt in PostgreSQL', async () => {
      await reset();
      const template='50000000-0000-0000-0000-000000000001';
      await db.exec(`insert into public.recurring_templates(id,user_id,name,expected_amount,frequency,day_of_month,next_due_date,status)
        values('${template}','${U}','Agenda',100,'monthly',10,'2026-10-10','pending')`);
      const paid=await db.query('select public.pay_agenda_occurrence($1,$2,$3) as id',[template,'2026-10-10',A]);
      const again=await db.query('select public.pay_agenda_occurrence($1,$2,$3) as id',[template,'2026-10-10',A]);
      assert.equal(paid.rows[0].id,again.rows[0].id); assert.equal(await balance(),900);
      await assert.rejects(rpc('update_transaction',{id:paid.rows[0].id,updates:{amount:1}}),/reversión contable/);
      await assert.rejects(rpc('delete_transaction',{id:paid.rows[0].id}),/reversión contable/);
      const overloads=await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='pay_agenda_occurrence'`);
      assert.equal(overloads.rows[0].n,1);
    });
    await t.test('partial and full card payments charge fees once, release only paid principal and preserve a protected receipt', async () => {
      await reset();
      await rpc('create_purchase',{credit_card_id:CARD,name:'Purchase',amount_total:1000,installment_total:1,amount_per_installment:1000,purchase_date:'2026-10-01'});
      assert.equal(await debt(),1000);
      const statement='60000000-0000-0000-0000-000000000001';
      await db.exec(`reset role; update public.accounts set balance=2000 where id='${A}';
        insert into public.billing_statements(id,user_id,credit_card_id,billing_period,billing_date,payment_due_date,total_due,maintenance_cost,amount_paid,status)
        values('${statement}','${U}','${CARD}','2026-10','2026-10-15','2026-11-05',1100,100,0,'pending'); set role authenticated;`);
      const payload=amount=>({statement_id:statement,card_id:CARD,account_id:A,amount});
      const key=randomUUID();
      const first=await rpc('pay_statement',payload(50),key);
      const retry=await rpc('pay_statement',payload(50),key);
      assert.equal(first.transaction_id,retry.transaction_id); assert.equal(await balance(),1950); assert.equal(await debt(),1000);
      await rpc('pay_statement',payload(150));
      assert.equal(await debt(),900); assert.equal(await balance(),1800);
      const final=await rpc('pay_statement',payload(900));
      assert.equal(await debt(),0); assert.equal(await balance(),900);
      assert.equal(Number((await db.query('select amount_paid from public.billing_statements where id=$1',[statement])).rows[0].amount_paid),1100);
      const ledger=(await db.query('select remaining_principal,status from public.credit_card_ledger')).rows[0];
      assert.equal(Number(ledger.remaining_principal),0); assert.equal(ledger.status,'paid');
      await assert.rejects(rpc('delete_transaction',{id:final.transaction_id}),/reversión contable/);
      await assert.rejects(rpc('pay_statement',payload(1)),/supera el saldo/);
      assert.equal(await balance(),900);
    });
    await t.test('failed card payments do not change the statement, ledger or card debt', async () => {
      await reset();
      await rpc('create_purchase',{credit_card_id:CARD,name:'Installments',amount_total:300,installment_total:3,amount_per_installment:100,purchase_date:'2026-10-01'});
      const statement='60000000-0000-0000-0000-000000000001';
      await db.exec(`insert into public.billing_statements(id,user_id,credit_card_id,billing_period,billing_date,payment_due_date,total_due,amount_paid,status)
        values('${statement}','${U}','${CARD}','2026-10','2026-10-15','2026-11-05',100,0,'pending')`);
      await assert.rejects(rpc('pay_statement',{statement_id:statement,account_id:FOREIGN,amount:100}),/propia activa/);
      assert.equal(await debt(),300);
      assert.equal(Number((await db.query('select amount_paid from public.billing_statements')).rows[0].amount_paid),0);
      await rpc('pay_statement',{statement_id:statement,account_id:A,amount:50});
      let row=(await db.query('select installment_current,remaining_principal from public.credit_card_ledger')).rows[0];
      assert.equal(row.installment_current,1); assert.equal(Number(row.remaining_principal),250);
      await rpc('pay_statement',{statement_id:statement,account_id:A,amount:50});
      row=(await db.query('select installment_current,remaining_principal from public.credit_card_ledger')).rows[0];
      assert.equal(row.installment_current,2); assert.equal(Number(row.remaining_principal),200);
    });
    await t.test('same-account transfer edits and foreign transaction edits are rejected', async () => {
      await reset();
      const row=await rpc('create_transaction',tx({destination_account_id:B}));
      await assert.rejects(rpc('update_transaction',{id:row.id,updates:{destination_account_id:A}}),/dos cuentas distintas/);
      assert.equal(await balance(),900); assert.equal(await balance(B),600);
      const foreignTx='70000000-0000-0000-0000-000000000001';
      await db.exec(`reset role; select set_config('request.jwt.claim.sub','${OTHER}',false);
        insert into public.transactions(id,user_id,account_id,name,type,amount,status) values('${foreignTx}','${OTHER}','${FOREIGN}','Other','expense',10,'paid');
        select set_config('request.jwt.claim.sub','${U}',false); set role authenticated;`);
      await assert.rejects(rpc('update_transaction',{id:foreignTx,updates:{amount:20}}),/sin acceso/);
      assert.equal(await balance(FOREIGN),890);
    });
    await t.test('instrument archival preserves transactions and refuses an unpaid card', async () => {
      await reset(); const row=await rpc('create_transaction',tx());
      await rpc('archive_account',{id:A});
      assert.equal((await db.query('select is_archived from public.accounts where id=$1',[A])).rows[0].is_archived,true);
      assert.equal((await db.query('select id from public.transactions where id=$1',[row.id])).rows.length,1);
      await rpc('create_purchase',{credit_card_id:CARD,name:'Purchase',amount_total:100,installment_total:1,amount_per_installment:100});
      await assert.rejects(rpc('archive_card',{id:CARD}),/Paga la deuda/);
    });
    await t.test('the non-mock wallet repository delegates to one atomic RPC without writing balances', async () => {
      await reset();
      const input=readFileSync(new URL('../src/features/wallet/api/transactionRepository.ts',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
      const output=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
      const calls=[]; const exports={};
      vm.runInNewContext(output,{ exports, USE_MOCKS:false, console, Set, Map,
        accountingMutation: async (operation,payload,key)=>{calls.push(operation);return rpc(operation,payload,key);},
        createClient:()=>({ from:()=>({ select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null}) }) }),
        createNotification:async()=>true,checkBudgetLimits:async()=>{},
      });
      const key=randomUUID();
      const row=await exports.addTransaction(tx({destination_account_id:B}),true,key);
      await exports.addTransaction(tx({destination_account_id:B}),true,key);
      assert.equal(await balance(),900); assert.equal(await balance(B),600);
      await exports.updateTransaction(row.id,{amount:150});
      assert.equal(await balance(),850); assert.equal(await balance(B),650);
      await exports.deleteTransaction(row.id);
      assert.equal(await balance(),1000); assert.equal(await balance(B),500);
      assert.deepEqual(calls,['create_transaction','create_transaction','update_transaction','delete_transaction']);
    });
    await t.test('goal plans persist through the real repository across reload and metadata edits', async () => {
      await reset();
      const input=readFileSync(new URL('../src/features/goals/api/goalRepository.ts',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
      const output=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
      const exports={};
      const client={auth:{getUser:async()=>({data:{user:{id:U}}})},from:()=>{
        let op='read',payload,filters=[],head=false;
        const chain={
          select(_columns,options){head=Boolean(options?.head);return chain;},
          eq(column,value){filters.push([column,value]);return chain;},
          insert(value){op='insert';payload=value[0];return chain;},
          update(value){op='update';payload=value;return chain;},
          async execute(single){
            try {
              const params=[]; const where=filters.map(([column,value])=>{params.push(value);return `"${column}"=$${params.length}`;});
              if(head) return {count:Number((await db.query('select count(*) as n from public.goals where '+where.join(' and '),params)).rows[0].n),error:null};
              let result;
              if(op==='read') result=await db.query('select * from public.goals');
              else if(op==='insert') {const keys=Object.keys(payload);result=await db.query(`insert into public.goals (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(payload));}
              else {const keys=Object.keys(payload);const values=Object.values(payload); result=await db.query(`update public.goals set ${keys.map((key,i)=>key+'=$'+(i+1)).join(',')} where id=$${keys.length+1} returning *`,[...values,filters.find(([key])=>key==='id')[1]]);}
              return {data:single ? result.rows[0] : result.rows,error:null};
            } catch(error){return {data:null,error};}
          },
          single(){return chain.execute(true);},
          then(resolve,reject){return chain.execute(false).then(resolve,reject);}
        };return chain;
      }};
      vm.runInNewContext(output,{exports,USE_MOCKS:false,console,createClient:()=>client,createNotification:async()=>true});
      const payload={name:'Plan',target_amount:100000,current_amount:0,start_date:'2026-10-18',deadline_date:'2027-08-18',contribution_type:'fixed',contribution_amount:10000,priority:'mid',reminders:true,color:'#6d28d9',icon_name:'Flag'};
      const saved=await exports.addGoal(payload);
      let loaded=(await exports.getGoals()).find(g=>g.id===saved.id);
      assert.equal(loaded.contribution_type,'fixed');assert.equal(loaded.contribution_amount,10000);
      await exports.updateGoal(saved.id,{name:'Renamed'});
      loaded=(await exports.getGoals()).find(g=>g.id===saved.id);
      assert.equal(loaded.contribution_type,'fixed');assert.equal(loaded.contribution_amount,10000);
      await exports.updateGoal(saved.id,{contribution_type:'free'});
      loaded=(await exports.getGoals()).find(g=>g.id===saved.id);
      assert.equal(loaded.contribution_amount,0);assert.equal(loaded.reminders,false);
      await exports.updateGoal(saved.id,{contribution_type:'auto',contribution_amount:20000,reminders:true});
      loaded=(await exports.getGoals()).find(g=>g.id===saved.id);
      assert.equal(loaded.contribution_type,'auto');assert.equal(loaded.contribution_amount,20000);assert.equal(loaded.reminders,true);
      assert.equal(await balance(),1000);
    });
    await t.test('fixed goal commitments start next month, cap the last payment, preserve receipts and count the goal once', async () => {
      await reset();
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Fixed plan',250,0,'2030-01-31','2030-04-30','fixed',100)`);
      const occurrences=async()=> (await db.query("select * from public.get_goal_agenda_occurrences('2030-01-01','2030-04-30')")).rows;
      let rows=await occurrences();assert.equal(rows.length,3);assert.equal(new Date(rows[0].occurrence_date).toISOString().slice(0,10),'2030-02-28');assert.equal(Number(rows[2].amount),50);
      const pay=()=>db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,100,$3) as id",[GOAL,A,B]);
      const first=(await pay()).rows[0].id;assert.equal((await pay()).rows[0].id,first);
      assert.equal(await balance(),900);assert.equal(await balance(B),600);assert.equal(await goal(),100);
      assert.equal((await db.query('select count(*)::int as n from public.transactions')).rows[0].n,2);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,99,$3)",[GOAL,A,B]),/otros datos/);
      await assert.rejects(rpc('delete_transaction',{id:first}),/protegido/);
      const incoming=(await db.query("select id from public.transactions where type='income'")).rows[0].id;
      await assert.rejects(rpc('update_transaction',{id:incoming,updates:{amount:99}}),/protegido/);
      await db.query("select public.pay_goal_occurrence($1,'2030-03-31',$2,100,null)",[GOAL,A]);
      await db.query("select public.pay_goal_occurrence($1,'2030-04-30',$2,50,null)",[GOAL,A]);
      assert.equal(await goal(),250);rows=await occurrences();assert.equal(rows.length,3);assert.ok(rows.every(r=>r.status==='paid'));
    });
    await t.test('automatic goal payments recalculate pending amounts and reject stale quotes; flexible asks for a positive amount', async () => {
      await reset();
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Auto plan',100,0,'2030-01-31','2030-04-30','auto',34)`);
      const rows=(await db.query("select * from public.get_goal_agenda_occurrences('2030-02-01','2030-04-30')")).rows;
      assert.equal(Number(rows[0].amount),34);
      await db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,34,null)",[GOAL,A]);
      const next=(await db.query("select * from public.get_goal_agenda_occurrences('2030-03-01','2030-03-31')")).rows[0];
      assert.equal(Number(next.amount),33);
      assert.equal(Number((await db.query('select contribution_amount from public.goals where id=$1',[GOAL])).rows[0].contribution_amount),33);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-03-31',$2,34,null)",[GOAL,A]),/Actualiza Agenda/);
      assert.equal(await goal(),34);assert.equal(await balance(),966);
      await reset();
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Flexible',100,0,'2030-01-31','2030-04-30','free',0)`);
      const flexible=(await db.query("select * from public.get_goal_agenda_occurrences('2030-02-01','2030-02-28')")).rows[0];
      assert.equal(Number(flexible.amount),0);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,0,null)",[GOAL,A]),/positivo/);
      await db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,17,null)",[GOAL,A]);
      assert.equal(await goal(),17);assert.equal(await balance(),983);
      const march=(await db.query("select * from public.get_goal_agenda_occurrences('2030-03-01','2030-03-31')")).rows[0];assert.equal(Number(march.amount),0);
    });
    await t.test('goal commitments reject invalid dates, foreign owners and failed destinations without partial effects', async () => {
      await reset();
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Fixed',2000,0,'2030-01-31','2030-04-30','fixed',1000)`);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-01-31',$2,1000,null)",[GOAL,A]),/fecha/);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-27',$2,1000,null)",[GOAL,A]),/fecha/);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,1000,$3)",[GOAL,A,FOREIGN]),/propia activa/);
      assert.equal(await goal(),0);assert.equal(await balance(),1000);
      assert.equal((await db.query('select count(*)::int as n from public.agenda_occurrence_payments')).rows[0].n,0);
      await db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,1000,null)",[GOAL,A]);
      await db.exec(`select set_config('request.jwt.claim.sub','${OTHER}',false)`);
      assert.equal((await db.query('select count(*)::int as n from public.agenda_occurrence_payments')).rows[0].n,0);
      assert.equal((await db.query("select * from public.get_goal_agenda_occurrences('2030-01-01','2030-04-30')")).rows.length,0);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,1000,null)",[GOAL,FOREIGN]),/sin acceso/);
    });
    await t.test('editing a goal plan updates future commitments and preserves paid history; legacy pending entries block duplicate payment', async () => {
      await reset();
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Fixed',300,0,'2030-01-31','2030-04-30','fixed',100)`);
      await db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,100,null)",[GOAL,A]);
      await db.query("update public.goals set name='Renamed' where id=$1",[GOAL]);
      assert.equal((await db.query("select plan_start_date::text as d from public.goals where id=$1",[GOAL])).rows[0].d,'2030-01-31');
      await db.query("update public.goals set contribution_type='free',contribution_amount=0 where id=$1",[GOAL]);
      const historic=(await db.query("select * from public.get_goal_agenda_occurrences('2030-02-01','2030-02-28')")).rows;
      assert.equal(historic.length,1);assert.equal(historic[0].status,'paid');assert.equal(Number(historic[0].amount),100);
      await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
      await assert.rejects(db.query("select * from public.get_goal_agenda_occurrences('2030-01-01','2030-04-30')"),/sesión/);
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,100,null)",[GOAL,A]),/sesión/);
      await reset();
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Fixed',300,0,'2030-01-31','2030-04-30','fixed',100)`);
      await rpc('create_transaction',tx({goal_id:GOAL,status:'pending',date:'2030-02-28T12:00:00Z'}));
      await assert.rejects(db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,100,null)",[GOAL,A]),/heredado/);
      assert.equal(await goal(),0);assert.equal(await balance(),1000);
    });
    await t.test('skipping a pending goal changes its plan once and never touches cash', async () => {
      await reset();
      await db.exec(`update public.goals set contribution_type='fixed',deadline_date='2026-11-30' where id='${GOAL}'`);
      const pending=await rpc('create_transaction',tx({goal_id:GOAL,status:'pending'}));
      const key=randomUUID(); const payload={id:pending.id,goal_id:GOAL};
      await rpc('skip_pending',payload,key); await rpc('skip_pending',payload,key);
      assert.equal(await balance(),1000); assert.equal(await goal(),0);
      const deadline=(await db.query('select deadline_date::date::text as date from public.goals where id=$1',[GOAL])).rows[0].date;
      assert.equal(deadline,'2026-12-30');
      await assert.rejects(rpc('skip_pending',payload),/Solo se pueden omitir/);
    });
    await t.test('unauthenticated financial RPC calls fail before changing money', async () => {
      await reset();
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(rpc('create_transaction',tx()),/Debes iniciar sesión/);
      assert.equal(await balance(),1000);
    });
    await t.test('unknown legacy purchase history stops payment without guessing a capital balance', async () => {
      await reset();
      await rpc('create_purchase',{credit_card_id:CARD,name:'Legacy',amount_total:100,installment_total:1,amount_per_installment:100});
      const statement='60000000-0000-0000-0000-000000000001';
      await db.exec(`reset role; alter table public.credit_card_ledger alter column created_at drop not null;
        alter table public.credit_card_ledger disable trigger trg_ledger_accounting;
        update public.credit_card_ledger set created_at=null,remaining_principal=null;
        alter table public.credit_card_ledger enable trigger trg_ledger_accounting;
        insert into public.billing_statements(id,user_id,credit_card_id,billing_period,billing_date,payment_due_date,total_due,amount_paid,status)
        values('${statement}','${U}','${CARD}','2026-10','2026-10-15','2026-11-05',100,20,'pending'); set role authenticated;`);
      const payload={statement_id:statement,account_id:A,amount:10};
      await assert.rejects(rpc('pay_statement',payload),/Conciliar las compras históricas/);
      await db.exec(`reset role; alter table public.credit_card_ledger disable trigger trg_ledger_accounting;
        update public.credit_card_ledger set created_at=now(); alter table public.credit_card_ledger enable trigger trg_ledger_accounting; set role authenticated;`);
      await assert.rejects(rpc('pay_statement',payload),/Conciliar el capital/);
      assert.equal(await balance(),1000); assert.equal(await debt(),100);
      assert.equal(Number((await db.query('select amount_paid from public.billing_statements')).rows[0].amount_paid),20);
    });
    await t.test('a card cannot have two statements for the same period', async () => {
      await reset();
      const sql=`insert into public.billing_statements(user_id,credit_card_id,billing_period,billing_date,payment_due_date,total_due,status)
        values('${U}','${CARD}','2026-10','2026-10-15','2026-11-05',100,'pending')`;
      await db.exec(sql);
      await assert.rejects(db.exec(sql),/duplicate key/);
      assert.equal((await db.query('select count(*)::int as n from public.billing_statements')).rows[0].n,1);
    });
    await t.test('a statement payment does not advance a purchase recorded after that statement', async () => {
      await reset();
      const old=await rpc('create_purchase',{credit_card_id:CARD,name:'Billed',amount_total:300,installment_total:3,amount_per_installment:100,purchase_date:'2026-10-01'});
      const statement='60000000-0000-0000-0000-000000000001';
      await db.exec(`insert into public.billing_statements(id,user_id,credit_card_id,billing_period,billing_date,payment_due_date,total_due,amount_paid,status)
        values('${statement}','${U}','${CARD}','2026-10','2026-10-15','2026-11-05',100,0,'pending')`);
      const fresh=await rpc('create_purchase',{credit_card_id:CARD,name:'Unbilled',amount_total:99,installment_total:3,amount_per_installment:33,purchase_date:'2026-10-05'});
      await rpc('pay_statement',{statement_id:statement,account_id:A,amount:100});
      const rows=(await db.query('select id,installment_current,remaining_principal from public.credit_card_ledger')).rows;
      assert.equal(rows.find(row=>row.id===old.id).installment_current,2);
      assert.equal(rows.find(row=>row.id===fresh.id).installment_current,1);
      assert.equal(Number(rows.find(row=>row.id===fresh.id).remaining_principal),99);
      assert.equal(await debt(),299);
    });
    await t.test('paid transactions cannot be deleted without reversing; direct browser writes are denied', async () => {
      await reset(); const row=await rpc('create_transaction',tx());
      await assert.rejects(rpc('delete_transaction',{id:row.id,revert_balance:false}),/exige revertir/);
      await assert.rejects(db.query('update public.transactions set amount=1 where id=$1',[row.id]),/permission denied/);
      assert.equal(await balance(),900);
    });
    await t.test('creation bound rejects retroactive recurring payments atomically while retaining historical retries',async()=>{
      await reset();
      const template='50000000-0000-0000-0000-000000000077';
      await db.exec(`insert into public.recurring_templates(id,user_id,name,expected_amount,frequency,day_of_month,next_due_date,created_at)
        values('${template}','${U}','New recurring',100,'monthly',5,'2026-11-05','2026-10-19T15:00:00Z')`);
      const old=(await db.query('select public.pay_agenda_occurrence($1,$2,$3) as id',[template,'2026-09-05',A])).rows[0].id;
      await db.exec('reset role');
      const migration=readFileSync(new URL('../supabase/migrations/20261019000003_agenda_recurrence_creation_bound.sql',import.meta.url),'utf8');
      await db.exec(migration);await db.exec(migration);await db.exec('set role authenticated');
      const before=await balance();
      await assert.rejects(db.query('select public.pay_agenda_occurrence($1,$2,$3)',[template,'2026-10-05',A]),/antes de su fecha de creación/);
      assert.equal(await balance(),before);
      assert.equal((await db.query('select count(*)::int as n from public.transactions')).rows[0].n,1);
      assert.equal((await db.query('select public.pay_agenda_occurrence($1,$2,$3) as id',[template,'2026-09-05',A])).rows[0].id,old);
      await db.query('select public.pay_agenda_occurrence($1,$2,$3)',[template,'2026-11-05',A]);
      assert.equal(await balance(),before-100);
    });
  } finally { if (db) await db.close(); }
});


test('older reference schema without creation timestamps/archive columns also supports atomic opening balances and purchases', async () => {
  try {
    await setup(true); await reset();
    const account=await rpc('create_account',{name:'Legacy-compatible',type:'cash',balance:200});
    assert.equal(Number(account.balance),200);
    const purchase=await rpc('create_purchase',{credit_card_id:CARD,name:'New purchase',amount_total:100,installment_total:1,amount_per_installment:100});
    assert.ok(purchase.created_at); assert.equal(await debt(),100);
  } finally { if (db) await db.close(); }
});

for (const withGoalAgenda of [false,true]) test(`restoring original tables preserves populated receipts and money (goal migration applied: ${withGoalAgenda})`, async () => {
  try {
    await setup(false,false,withGoalAgenda);await reset();
    const key=randomUUID();const payload=tx({type:'income',amount:100});
    const income=await rpc('create_transaction',payload,key);
    await rpc('create_purchase',{credit_card_id:CARD,name:'Purchase',amount_total:300,installment_total:3,amount_per_installment:100,purchase_date:'2026-10-01'});
    const statement='60000000-0000-0000-0000-000000000099';
    await db.query(`insert into public.billing_statements(id,user_id,credit_card_id,billing_period,billing_date,payment_due_date,total_due,maintenance_cost)
      values($1,$2,$3,'2026-10','2026-10-15','2026-11-05',110,10)`,[statement,U,CARD]);
    const billKey=randomUUID();const billPayload={statement_id:statement,account_id:A,amount:60};
    const payment=await rpc('pay_statement',billPayload,billKey);
    const template='70000000-0000-0000-0000-000000000099';
    await db.query(`insert into public.recurring_templates(id,user_id,name,expected_amount,frequency,day_of_month,next_due_date)
      values($1,$2,'Ordinary bill',25,'monthly',10,'2026-10-10')`,[template,U]);
    const ordinary=(await db.query("select public.pay_agenda_occurrence($1,'2026-10-10',$2,25) as id",[template,A])).rows[0].id;
    let goalPayment;
    if(withGoalAgenda) {
      await db.exec(`delete from public.goals where id='${GOAL}';insert into public.goals(id,user_id,name,target_amount,current_amount,start_date,deadline_date,contribution_type,contribution_amount)
        values('${GOAL}','${U}','Fixed',200,0,'2030-01-31','2030-03-31','fixed',100)`);
      goalPayment=(await db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,100,$3) as id",[GOAL,A,B])).rows[0].id;
    }
    const money=async()=>JSON.stringify({
      accounts:(await db.query('select id,balance,current_balance from public.accounts order by id')).rows,
      goals:(await db.query('select id,current_amount from public.goals order by id')).rows,
      cards:(await db.query('select id,current_debt from public.credit_cards order by id')).rows,
      ledger:(await db.query('select id,remaining_principal,installment_current,status from public.credit_card_ledger order by id')).rows,
      tx:(await db.query('select * from public.transactions order by id')).rows,
      statement:(await db.query('select id,amount_paid,status from public.billing_statements order by id')).rows,
    });
    const before=await money();
    await db.exec('reset role');
    await db.exec(readFileSync(new URL('../supabase/migrations/20261018000004_restore_original_tables.sql',import.meta.url),'utf8'));
    const actual=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(row=>row.tablename);
    const original=[...readFileSync(new URL('../supabase/schema-staging.sql',import.meta.url),'utf8').matchAll(/CREATE TABLE public\.(\w+)/g)].map(match=>match[1]).sort();
    assert.deepEqual(actual,original);assert.equal(actual.length,19);
    assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='private'")).rows[0].n,0);
    assert.equal(await money(),before);
    const allocations=(await db.query('select principal_items from public.billing_statements where id=$1',[statement])).rows[0].principal_items;
    assert.equal(allocations.length,1);assert.equal(Number(allocations[0].paid),50);
    await db.exec('set role authenticated');
    assert.equal((await rpc('create_transaction',payload,key)).id,income.id);
    assert.equal((await rpc('pay_statement',billPayload,billKey)).transaction_id,payment.transaction_id);
    assert.equal((await db.query("select public.pay_agenda_occurrence($1,'2026-10-10',$2,25) as id",[template,A])).rows[0].id,ordinary);
    if(withGoalAgenda) assert.equal((await db.query("select public.pay_goal_occurrence($1,'2030-02-28',$2,100,$3) as id",[GOAL,A,B])).rows[0].id,goalPayment);
    assert.equal(await money(),before);
    assert.equal((await db.query("select count(*)::int as n from public.agenda_occurrence_payments where receipt_type='request'")).rows[0].n,0);
    const finish=await rpc('pay_statement',{statement_id:statement,account_id:A,amount:50});
    assert.equal(Number(finish.amount_paid),110);assert.equal(await debt(),200);
  } finally {if(db)await db.close();}
});

test('an unknown dependency aborts table restoration without CASCADE or partial changes', async () => {
  try {
    await setup(false,false,false);await reset();
    const row=await rpc('create_transaction',tx());const before=await balance();
    await db.exec('reset role;create view public.external_receipt_dependency as select * from public.billing_payments');
    await assert.rejects(db.exec(readFileSync(new URL('../supabase/migrations/20261018000004_restore_original_tables.sql',import.meta.url),'utf8')),/depend/);
    await db.exec('rollback');
    assert.ok((await db.query("select to_regclass('public.billing_payments') as relation")).rows[0].relation);
    assert.ok((await db.query("select to_regclass('private.accounting_requests') as relation")).rows[0].relation);
    assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='agenda_occurrence_payments' and column_name='receipt_type'")).rows[0].n,0);
    assert.equal(await balance(),before);
    assert.equal(Number((await db.query('select amount from public.transactions where id=$1',[row.id])).rows[0].amount),100);
  } finally {if(db)await db.close();}
});
