import * as jsxRuntime from 'react/jsx-runtime';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { visibleName } from '../src/features/auth/model/profileIdentity.ts';
function load(path, globals) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals });
  return exports;
}
const U = '10000000-0000-0000-0000-000000000001';
const OTHER = '10000000-0000-0000-0000-000000000002';
const EMPTY = '10000000-0000-0000-0000-000000000003';
const NEW = '10000000-0000-0000-0000-000000000004';
const sql = readFileSync(new URL('../supabase/migrations/20261019000001_sync_profile_identity.sql', import.meta.url), 'utf8');

test('visible names honor explicit edits and nicknames before legacy first/last names', () => {
  assert.equal(visibleName({ name: ' Nico ', first_name: 'Nicolás', last_name: 'Torres' }), 'Nico');
  assert.equal(visibleName({ full_name: ' Visible ' }), 'Visible');
  assert.equal(visibleName({ first_name: 'Ángel', last_name: 'Seguel' }), 'Ángel Seguel');
  assert.equal(visibleName({ first_name: 'Apodo' }), 'Apodo');
  assert.equal(visibleName({ name: {}, first_name: 123 }, 'Alternativa'), 'Alternativa');
});

test('profile edits update both canonical metadata fields in a single Auth operation', async () => {
  let received;
  const api = load('../src/features/settings/api/userRepository.ts', { USE_MOCKS: false, visibleName, createClient: () => ({ auth: { updateUser: async input => { received = input; return { error: null }; } } }) });
  await api.updateProfileName(' Nico ');
  assert.equal(received.data.name, 'Nico'); assert.equal(received.data.full_name, 'Nico');
  assert.equal('role' in received.data, false);
  await assert.rejects(api.updateProfileName('  '), /nombre visible/);
});

test('staging migration repairs default names only and atomically syncs future identities without altering roles', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');`);
    await db.exec(readFileSync(new URL('../supabase/schema-staging.sql', import.meta.url), 'utf8'));
    await db.exec(`alter table public.profiles add column email text;
      insert into auth.users values ('${U}','nico@example.com','{"first_name":"Nicolás","last_name":"Torres"}'),('${OTHER}','other@example.com','{"name":"Nombre en Auth"}'),('${EMPTY}',null,'{}');
      insert into public.profiles(id,full_name,role,is_admin,financial_cycle_start_day,monthly_estimated_income) values
      ('${U}','Usuario Kyo','admin',true,6,900000),('${OTHER}','Nombre conservado','user',false,1,0),('${EMPTY}','Usuario Kyo','user',false,1,0);`);
    const columns = (await db.query(`select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='profiles'`)).rows[0].n;
    await db.exec(sql); await db.exec(sql);
    const repaired = (await db.query(`select * from public.profiles where id='${U}'`)).rows[0];
    assert.equal(repaired.full_name, 'Nicolás Torres'); assert.equal(repaired.email, 'nico@example.com'); assert.equal(repaired.role, 'admin'); assert.equal(repaired.is_admin, true); assert.equal(repaired.financial_cycle_start_day, 6); assert.equal(Number(repaired.monthly_estimated_income), 900000);
    assert.equal((await db.query(`select full_name from public.profiles where id='${OTHER}'`)).rows[0].full_name, 'Nombre conservado');
    assert.equal((await db.query(`select full_name from public.profiles where id='${EMPTY}'`)).rows[0].full_name, 'Usuario Kyo');
    await db.exec(`insert into auth.users values ('${NEW}','new@example.com','{"name":"KyoNick","first_name":"KyoNick","role":"superadmin","is_admin":true}');`);
    assert.equal((await db.query(`select full_name from public.profiles where id='${NEW}'`)).rows[0].full_name, 'KyoNick');
    const created = (await db.query(`select role,is_admin from public.profiles where id='${NEW}'`)).rows[0];
    assert.equal(created.role, 'user'); assert.equal(created.is_admin, false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.sync_auth_profile_identity()','execute') as allowed")).rows[0].allowed, false);
    await db.exec(`update auth.users set raw_user_meta_data=raw_user_meta_data || '{"name":"Nico","full_name":"Nico","role":"superadmin","is_admin":true}' where id='${U}';`);
    const edited = (await db.query(`select * from public.profiles where id='${U}'`)).rows[0];
    assert.equal(edited.full_name, 'Nico'); assert.equal(edited.role, 'admin');
    await db.exec(`update public.profiles set full_name='Nombre conservado manualmente' where id='${OTHER}'; update auth.users set raw_user_meta_data=raw_user_meta_data || '{"settings":{"theme":"dark"}}' where id='${OTHER}';`);
    assert.equal((await db.query(`select full_name from public.profiles where id='${OTHER}'`)).rows[0].full_name, 'Nombre conservado manualmente');
    await db.exec(`update auth.users set email='changed@example.com' where id='${NEW}'`);
    assert.equal((await db.query(`select email from public.profiles where id='${NEW}'`)).rows[0].email, 'changed@example.com');
    await db.exec(`create function public.fail_identity_update() returns trigger language plpgsql as $$ begin if new.full_name='Rejected' then raise exception 'blocked update'; end if; return new; end $$;
      create trigger fail_identity before update on public.profiles for each row execute function public.fail_identity_update();`);
    await assert.rejects(db.exec(`update auth.users set raw_user_meta_data='{"name":"Rejected"}' where id='${NEW}'`), /blocked update/);
    assert.equal((await db.query(`select raw_user_meta_data->>'name' as name from auth.users where id='${NEW}'`)).rows[0].name, 'KyoNick');
    assert.equal((await db.query(`select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='profiles'`)).rows[0].n, columns);
  } finally { await db.close(); }
});

test('identity migration also works against the unextended staging reference without email column', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');`);
    await db.exec(readFileSync(new URL('../supabase/schema-staging.sql', import.meta.url), 'utf8'));
    await db.exec(sql);
    await db.exec(`insert into auth.users values ('${NEW}','test@example.com','{"name":"Alias"}');`);
    assert.equal((await db.query('select full_name from public.profiles')).rows[0].full_name, 'Alias');
    assert.equal((await db.query(`select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='email'`)).rows[0].n, 0);
  } finally { await db.close(); }
});


test('registration accepts a nickname without collecting or sending a surname, retaining invitation/password validation', async () => {
  const source = readFileSync(new URL('../src/features/auth/components/RegisterScreen.tsx', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  async function run(name, password = 'StrongPass1', invitation = 'KYO-TEST-0001') {
    let index = 0; const calls = []; const values = [false, null, false, name, 'NICO@EXAMPLE.COM', password, password, invitation, false, false];
    const exports = {}; const icon = () => null;
    vm.runInNewContext(output, { exports, require: () => jsxRuntime, useState: initial => [values[index++] ?? (typeof initial === 'function' ? initial() : initial), () => {}], useMemo: callback => callback(), Link: icon, AuthLogo: icon, Eye: icon, EyeOff: icon, ArrowRight: icon, Check: icon, URLSearchParams, window: { location: { search: '' } }, betaCodeAvailable: async () => ({ data: true, error: null }), createClient: () => ({ auth: { signUp: async payload => { calls.push(payload); return { error: null }; } } }) });
    const tree = exports.RegisterScreen();
    function find(node) { if (!node || typeof node !== 'object') return null; if (node.type === 'form') return node; for (const child of [node.props?.children].flat(Infinity)) { const found = find(child); if (found) return found; } return null; }
    await find(tree).props.onSubmit({ preventDefault() {} });
    return calls;
  }
  const [signup] = await run(' Nico ');
  assert.equal(signup.options.data.name, 'Nico'); assert.equal(signup.options.data.full_name, 'Nico'); assert.equal(signup.email, 'nico@example.com');
  assert.equal('last_name' in signup.options.data, false);
  assert.equal((await run(' ')).length, 0); assert.equal((await run('Nico', 'weak')).length, 0); assert.equal((await run('Nico', 'StrongPass1', '')).length, 0);
});
