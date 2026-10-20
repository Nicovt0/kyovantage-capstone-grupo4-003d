import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

test('staging waitlist, consecutive invitations and signup consumption use existing tables', async t => {
  const db = new PGlite();
  const admin = randomUUID();
  async function claims(role = 'anon', id = null) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: 'authenticated', sub: id, app_metadata: { role } })]);
  }
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      grant usage on schema auth,public to anon,authenticated,service_role;`);
    await db.exec(readFileSync(new URL('../supabase/schema-staging.sql', import.meta.url), 'utf8'));
    const migration = readFileSync(new URL('../supabase/migrations/20261018000006_waitlist_signup_codes.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(`drop trigger zz_consume_signup_beta_code on auth.users;
      create policy legacy_public_codes on public.beta_invitations for select using(true);
      grant select on public.beta_invitations to anon;`);
    await db.exec(migration); // Can be reapplied without deleting existing users/codes.
    await db.exec(readFileSync(new URL('../supabase/migrations/20261019000001_sync_profile_identity.sql', import.meta.url), 'utf8'));

    await t.test('anonymous submissions normalize email, are idempotent and do not expose the list', async () => {
      await db.exec('set role anon');
      await db.query('select public.join_waitlist($1)', ['  TEST@EXAMPLE.COM ']);
      await db.query('select public.join_waitlist($1)', ['test@example.com']);
      await assert.rejects(db.query('select public.join_waitlist($1)', ['bad address']));
      await assert.rejects(db.query('select * from public.waitlist'));
      await assert.rejects(db.query('select * from public.beta_invitations'));
      await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 1);
      assert.equal((await db.query('select email from public.waitlist')).rows[0].email, 'test@example.com');
    });

    await t.test('only admins can generate and read codes; retries preserve the same code', async () => {
      await claims('user', randomUUID()); await db.exec('set role authenticated');
      await assert.rejects(db.query('select * from public.generate_beta_invitation($1)', [randomUUID()]));
      await db.exec('reset role');
      // Admin identity must already exist before the signup gate is installed.
      await db.exec('alter table auth.users disable trigger zz_consume_signup_beta_code');
      await db.query('insert into auth.users(id,email) values($1,$2)', [admin, 'admin@example.com']);
      await db.exec('alter table auth.users enable trigger zz_consume_signup_beta_code');
      await db.query("insert into public.beta_invitations(code) values('KYO-TEST-0007'),('KYO-LEGACY')");
      await claims('admin', admin); await db.exec('set role authenticated');
      const key = randomUUID();
      const first = (await db.query('select * from public.generate_beta_invitation($1)', [key])).rows[0];
      const retry = (await db.query('select * from public.generate_beta_invitation($1)', [key])).rows[0];
      assert.equal(first.code, 'KYO-TEST-0008'); assert.equal(retry.code, first.code);
      assert.equal((await db.query('select * from public.generate_beta_invitation($1)', [randomUUID()])).rows[0].code, 'KYO-TEST-0009');
      assert.equal((await db.query('select count(*)::int as n from public.beta_invitations')).rows[0].n, 4);
      await db.exec('reset role');
    });

    await t.test('waitlist approval shares numbering, binds the email and reuses its invitation', async () => {
      await claims('admin', admin); await db.exec('set role authenticated');
      const id = (await db.query('select id from public.waitlist')).rows[0].id;
      const first = (await db.query('select public.approve_waitlist_request($1) as id', [id])).rows[0].id;
      assert.equal((await db.query('select public.approve_waitlist_request($1) as id', [id])).rows[0].id, first);
      const row = (await db.query('select * from public.beta_invitations where id=$1', [first])).rows[0];
      assert.equal(row.code, 'KYO-TEST-0010'); assert.equal(row.recipient_email, 'test@example.com');
      await db.exec('reset role');
    });

    await t.test('signup rejects missing, foreign and used codes and consumes a valid code once', async () => {
      await claims();
      const create = (email, code) => db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [randomUUID(), email, JSON.stringify({ beta_code: code, name: 'Alias Beta' })]);
      await assert.rejects(create('test@example.com', ''));
      await assert.rejects(create('other@example.com', 'KYO-TEST-0010'));
      await create('TEST@example.com', ' kyo-test-0010 ');
      await assert.rejects(create('test@example.com', 'KYO-TEST-0010'));
      const row = (await db.query("select * from public.beta_invitations where code='KYO-TEST-0010'")).rows[0];
      assert.equal(row.is_used, true); assert.ok(row.used_by_user_id); assert.ok(row.used_at);
      assert.equal((await db.query('select full_name from public.profiles where id=$1', [row.used_by_user_id])).rows[0].full_name, 'Alias Beta');
    });

    await t.test('a later signup failure rolls back code consumption', async () => {
      await db.exec(`create function auth.fail_setup() returns trigger language plpgsql as $$begin raise exception 'setup failed'; end$$;
        create trigger zzz_fail_setup after insert on auth.users for each row execute function auth.fail_setup();`);
      await assert.rejects(db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'retry@example.com','{\"beta_code\":\"KYO-TEST-0009\"}')", [randomUUID()]));
      assert.equal((await db.query("select is_used from public.beta_invitations where code='KYO-TEST-0009'")).rows[0].is_used, false);
      await db.exec('drop trigger zzz_fail_setup on auth.users');
      await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'retry@example.com','{\"beta_code\":\"KYO-TEST-0009\"}')", [randomUUID()]);
      await claims('user', randomUUID()); await db.exec('set role authenticated');
      assert.equal((await db.query('select count(*)::int as n from public.beta_invitations')).rows[0].n, 0);
      await db.exec('reset role');
      assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public'")).rows[0].n, 19);
    });
  } finally { await db.close(); }
});
