-- Apply only to staging. Restore signup gating after legacy trigger/policy migrations. No new tables or columns beyond the existing staging schema.
-- Approval creates an invitation transactionally. Mail remains disabled until configured.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter table public.waitlist add column if not exists status text not null default 'pending';
alter table public.waitlist add column if not exists approved_at timestamptz;
alter table public.waitlist add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.waitlist add column if not exists invitation_id uuid references public.beta_invitations(id) on delete set null;
alter table public.waitlist add column if not exists sent_at timestamptz;
alter table public.waitlist add column if not exists last_error text;
alter table public.waitlist add column if not exists dispatch_token uuid;
alter table public.waitlist add column if not exists dispatch_started_at timestamptz;
alter table public.waitlist drop constraint if exists waitlist_status_check;
alter table public.waitlist add constraint waitlist_status_check check (status in ('pending','approved','rejected','sent','error'));
alter table public.beta_invitations add column if not exists recipient_email text;
alter table public.waitlist enable row level security;
alter table public.beta_invitations enable row level security;

-- Replace permissive policies rather than leaving a second OR-able policy behind.
do $$ declare item record; begin
  for item in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('waitlist','beta_invitations') loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
end $$;
revoke all on public.waitlist, public.beta_invitations from anon, authenticated;
grant insert (email) on public.waitlist to anon, authenticated;
grant select on public.waitlist to authenticated;
grant all on public.waitlist, public.beta_invitations to service_role;
create policy waitlist_public_request on public.waitlist for insert to anon, authenticated
  with check (status = 'pending' and invitation_id is null and approved_at is null and approved_by is null and sent_at is null and last_error is null and dispatch_token is null and dispatch_started_at is null and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
create policy waitlist_admin_read on public.waitlist for select to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin'));

-- One shared lock serializes numbering across manual generation and approval.
create or replace function private.next_beta_code() returns text
language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('kyo.beta.invitation.number',0));
  select coalesce(max(substring(code from '^KYO-TEST-([0-9]{1,12})$')::bigint),0)+1 into n from public.beta_invitations;
  return 'KYO-TEST-' || case when length(n::text)<4 then lpad(n::text,4,'0') else n::text end;
end $$;
revoke all on function private.next_beta_code() from public,anon,authenticated;
create or replace function private.approve_waitlist_request(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.waitlist%rowtype; invitation uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','superadmin') then raise exception 'Administrative access required' using errcode = '42501'; end if;
  select * into r from public.waitlist where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status in ('approved','error','sent') and r.invitation_id is not null then return r.invitation_id; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be approved'; end if;
  insert into public.beta_invitations (code, recipient_email, is_used)
    values (private.next_beta_code(), lower(btrim(r.email)), false) returning id into invitation;
  update public.waitlist set status = 'approved', invitation_id = invitation, approved_by = auth.uid(), approved_at = now(), last_error = null where id = p_id;
  return invitation;
end $$;
create or replace function public.approve_waitlist_request(p_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.approve_waitlist_request(p_id); $$;
revoke all on function private.approve_waitlist_request(uuid), public.approve_waitlist_request(uuid) from public, anon;
grant execute on function private.approve_waitlist_request(uuid), public.approve_waitlist_request(uuid) to authenticated;

create or replace function private.reject_waitlist_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','superadmin') then raise exception 'Administrative access required' using errcode = '42501'; end if;
  update public.waitlist set status = 'rejected' where id = p_id and status = 'pending';
  if not found then raise exception 'Only pending requests can be rejected'; end if;
end $$;
create or replace function public.reject_waitlist_request(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.reject_waitlist_request(p_id); $$;
revoke all on function private.reject_waitlist_request(uuid), public.reject_waitlist_request(uuid) from public, anon;
grant execute on function private.reject_waitlist_request(uuid), public.reject_waitlist_request(uuid) to authenticated;

-- A guessed code yields only a boolean, never a list or invitation owner.
create or replace function private.beta_code_available(p_code text, p_email text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.beta_invitations b where b.code = upper(btrim(p_code)) and not coalesce(b.is_used,false)
    and (p_email is null or b.recipient_email is null or lower(btrim(b.recipient_email)) = lower(btrim(p_email))));
$$;
create or replace function public.beta_code_available(p_code text, p_email text default null) returns boolean
language sql stable security invoker set search_path = '' as $$ select private.beta_code_available(p_code,p_email); $$;
revoke all on function private.beta_code_available(text,text), public.beta_code_available(text,text) from public;
grant execute on function private.beta_code_available(text,text), public.beta_code_available(text,text) to anon, authenticated;

-- Enforce the code at account creation; an exception rolls back the whole Auth
-- insert and all profile/setup triggers. Row lock prevents concurrent reuse.
create or replace function private.consume_signup_beta_code() returns trigger
language plpgsql security definer set search_path = '' as $$
declare invitation public.beta_invitations%rowtype; submitted_code text;
begin
  -- Server-side administrative user creation is allowed; public signup is gated.
  if coalesce(auth.jwt()->>'role','') = 'service_role' then return new; end if;
  submitted_code := upper(btrim(coalesce(new.raw_user_meta_data->>'beta_code','')));
  select * into invitation from public.beta_invitations where code = submitted_code for update;
  if not found or new.email is null or coalesce(invitation.is_used,false) or (invitation.recipient_email is not null and lower(btrim(invitation.recipient_email)) <> lower(btrim(new.email))) then
    raise exception 'Invalid or unavailable invitation code' using errcode = '22023';
  end if;
  update public.beta_invitations set is_used = true, used_by_user_id = new.id, used_at = now() where id = invitation.id;
  return new;
end $$;
revoke all on function private.consume_signup_beta_code() from public, anon, authenticated;
drop trigger if exists zz_consume_signup_beta_code on auth.users;
create trigger zz_consume_signup_beta_code after insert on auth.users for each row execute function private.consume_signup_beta_code();
-- The old public definer RPC accepts arbitrary user IDs and must be inaccessible.
do $$ begin
  if to_regprocedure('public.redeem_beta_code(text,uuid)') is not null then
    revoke all on function public.redeem_beta_code(text,uuid) from public, anon, authenticated;
  end if;
end $$;

-- Service-only dispatch lease; approval and retry use the same invitation/code.
create or replace function public.claim_beta_dispatch(p_id uuid, p_token uuid)
returns table (email text, code text, invitation_id uuid)
language plpgsql security invoker set search_path = '' as $$
begin
  update public.waitlist w set dispatch_token = p_token, dispatch_started_at = now(), last_error = null
    where w.id = p_id and w.status in ('approved','error') and w.invitation_id is not null
    and (w.dispatch_token is null or w.dispatch_started_at < now() - interval '2 minutes');
  if not found then raise exception 'Request unavailable, already sent, or dispatch in progress'; end if;
  return query select w.email, b.code, b.id from public.waitlist w join public.beta_invitations b on b.id = w.invitation_id where w.id = p_id;
end $$;
create or replace function public.finish_beta_dispatch(p_id uuid, p_token uuid, p_error text default null) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.waitlist set status = case when p_error is null then 'sent' else 'error' end,
    sent_at = case when p_error is null then now() else sent_at end, last_error = left(p_error,500), dispatch_token = null, dispatch_started_at = null
    where id = p_id and dispatch_token = p_token;
  return found;
end $$;
revoke all on function public.claim_beta_dispatch(uuid,uuid), public.finish_beta_dispatch(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_beta_dispatch(uuid,uuid), public.finish_beta_dispatch(uuid,uuid,text) to service_role;

create policy beta_invitations_admin_read on public.beta_invitations for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin'));
grant select on public.beta_invitations to authenticated;

create or replace function public.join_waitlist(p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare email_value text:=lower(btrim(p_email));
begin
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Introduce un correo válido.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('kyo.waitlist.'||email_value,0));
  if not exists(select 1 from public.waitlist where lower(btrim(email))=email_value) then
    insert into public.waitlist(email) values(email_value);
  end if;
end $$;
revoke all on function public.join_waitlist(text) from public;
grant execute on function public.join_waitlist(text) to anon,authenticated;

create or replace function public.generate_beta_invitation(p_request_id uuid)
returns setof public.beta_invitations language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','superadmin') then
    raise exception 'Administrative access required' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'Identificador requerido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kyo.beta.invitation.number',0));
  if not exists(select 1 from public.beta_invitations where id=p_request_id) then
    insert into public.beta_invitations(id,code,is_used) values(p_request_id,private.next_beta_code(),false);
  end if;
  return query select * from public.beta_invitations where id=p_request_id;
end $$;
revoke all on function public.generate_beta_invitation(uuid) from public,anon;
grant execute on function public.generate_beta_invitation(uuid) to authenticated;
commit;
