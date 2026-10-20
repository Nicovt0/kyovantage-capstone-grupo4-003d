import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load(path, globals) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals });
  return exports;
}

test('category reads use one unified table, scope globals/owner and propagate failures', async () => {
  let failure = null;
  const calls = [];
  const query = { select() { return this; }, or(value) { calls.push(value); return this; }, then(resolve) { return Promise.resolve({ data: [{ id: 'global', name: 'General' }, { id: 'owner', name: 'Personal' }, { name: 'Saldo Inicial' }], error: failure }).then(resolve); } };
  const api = load('../src/features/budget/api/categoryRepository.ts', { USE_MOCKS: false, createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => { assert.equal(table, 'categories'); return query; } }) });
  assert.equal((await api.getCategories()).length, 2);
  assert.equal(calls[0], 'user_id.is.null,user_id.eq.owner');
  failure = { message: 'denied' };
  await assert.rejects(api.getCategories(), /denied/);
});

test('used category deletion never rewrites transactions or removes budgets', async () => {
  const calls = [];
  const query = { delete() { return this; }, eq(key, value) { calls.push([key, value]); return this; }, select() { return this; }, single: async () => ({ data: null, error: { code: '23503' } }) };
  const api = load('../src/features/settings/api/customEntitiesRepository.ts', { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => { assert.equal(table, 'categories'); return query; } }) });
  await assert.rejects(api.deleteUserCustomCategory('used'), /en uso/);
  assert.ok(calls.some(([key, value]) => key === 'user_id' && value === 'owner'));
});

test('staging category policies isolate owners and protect global categories and history', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon;
      create table public.categories(id uuid primary key, user_id uuid, name text);
      create table public.transactions(category_id uuid references public.categories(id));
      create policy legacy_open on public.categories for all using (true) with check (true);
      insert into public.categories values ('00000000-0000-0000-0000-000000000001',null,'Global'),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Own'),('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Other');
      insert into public.transactions values ('00000000-0000-0000-0000-000000000002');`);
    const sql = readFileSync(new URL('../supabase/migrations/20261019000000_categories_owner_access.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    await db.exec(`select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false); set role authenticated;`);
    assert.equal((await db.query('select * from public.categories')).rows.length, 2);
    assert.equal((await db.query(`update public.categories set name='Changed' where user_id is null returning id`)).rows.length, 0);
    assert.equal((await db.query(`delete from public.categories where user_id='10000000-0000-0000-0000-000000000002' returning id`)).rows.length, 0);
    await assert.rejects(db.exec(`insert into public.categories values ('00000000-0000-0000-0000-000000000004',null,'Injected')`), /row-level security/);
    await assert.rejects(db.exec(`delete from public.categories where name='Own'`), /foreign key/);
    await db.exec(`insert into public.categories values ('00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','New'); update public.categories set name='Renamed' where name='New'; delete from public.categories where name='Renamed'; reset role; select set_config('request.jwt.claim.sub','',false); set role anon;`);
    assert.equal((await db.query('select * from public.categories')).rows.length, 1);
    await db.exec('reset role;');
    assert.equal((await db.query('select * from public.transactions')).rows.length, 1);
  } finally { await db.close(); }
});


test('category creation stores the owner and no color; edits whitelist name/icon only', async () => {
  let payload;
  const filters = [];
  const query = { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, order: async () => ({ data: [], error: null }), insert(value) { payload = value[0]; return this; }, update(value) { payload = value; return this; }, single: async () => ({ data: { id: 'saved' }, error: null }) };
  const api = load('../src/features/settings/api/customEntitiesRepository.ts', { createNotification: async () => {}, createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => { assert.equal(table, 'categories'); return query; } }) });
  await api.addUserCustomCategory(' Viajes ', 'expense', 'Plane');
  assert.equal(payload.name, 'Viajes');
  assert.equal(payload.user_id, 'owner');
  assert.equal('color' in payload, false);
  await api.updateUserCustomCategory('saved', { name: ' Nuevo ', icon_name: 'Tag', user_id: 'other', color: 'red', type: 'income' });
  assert.equal(payload.name, 'Nuevo');
  assert.equal(Object.keys(payload).sort().join(','), 'icon_name,name');
  assert.ok(filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
});
