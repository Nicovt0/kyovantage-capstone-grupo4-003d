import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('goal savings link validates ownership/type/activity, survives reload and clears on deletion', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table accounts(id uuid primary key,user_id uuid,type text,is_archived boolean default false);
      create table goals(id int primary key,user_id uuid,savings_account_id uuid references accounts(id) on delete set null);
      insert into accounts values
      ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','savings',false),
      ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','savings',false),
      ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','checking',false),
      ('00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','savings',true);`);
    const migration = readFileSync(new URL('../supabase/migrations/20261019000002_goal_savings_account.sql', import.meta.url),'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const insert = (id, account) => db.query('insert into goals values ($1,$2,$3)',[id,'10000000-0000-0000-0000-000000000001',account]);
    await insert(1,null);
    await insert(2,'00000000-0000-0000-0000-000000000001');
    assert.equal((await db.query('select savings_account_id from goals where id=2')).rows[0].savings_account_id,'00000000-0000-0000-0000-000000000001');
    for (const suffix of ['002','003','004']) await assert.rejects(insert(3,`00000000-0000-0000-0000-000000000${suffix}`),/cuenta de ahorro activa/);
    await assert.rejects(db.exec("update goals set user_id='10000000-0000-0000-0000-000000000002' where id=2"),/cuenta de ahorro activa/);
    await db.exec('alter table accounts add column is_active boolean default true');
    await db.exec("update accounts set is_active=false where id='00000000-0000-0000-0000-000000000001'");
    await assert.rejects(insert(3,'00000000-0000-0000-0000-000000000001'),/cuenta de ahorro activa/);
    await db.exec('update goals set id=4 where id=2');
    await db.exec("delete from accounts where id='00000000-0000-0000-0000-000000000001'");
    assert.equal((await db.query('select savings_account_id from goals where id=4')).rows[0].savings_account_id,null);
  } finally { await db.close(); }
});
