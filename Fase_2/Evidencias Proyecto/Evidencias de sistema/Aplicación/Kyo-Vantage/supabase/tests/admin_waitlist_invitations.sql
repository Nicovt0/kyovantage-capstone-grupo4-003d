-- Run after the migration in staging or a disposable database. Rolls back every
-- test user, profile/account side effect, waitlist request and invitation.
begin;
do $$
declare
  admin_id uuid := gen_random_uuid();
  requester_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  invitation uuid;
  invitation_again uuid;
  beta_code text;
  token uuid := gen_random_uuid();
  test_email text := 'qa-beta-' || gen_random_uuid()::text || '@example.invalid';
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into auth.users (id,email,raw_user_meta_data,raw_app_meta_data) values (admin_id, 'qa-admin-' || admin_id::text || '@example.invalid', '{}', '{"role":"admin"}');
  insert into public.waitlist(id,email) values(request_id,test_email);
  perform set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated','app_metadata',json_build_object('role','user'))::text,true);
  begin
    perform public.approve_waitlist_request(request_id);
    raise exception 'ASSERT: ordinary user approval allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated','app_metadata',json_build_object('role','admin'))::text,true);
  invitation := public.approve_waitlist_request(request_id);
  invitation_again := public.approve_waitlist_request(request_id);
  if invitation <> invitation_again then raise exception 'ASSERT: repeated approval created another invitation'; end if;
  select code into beta_code from public.beta_invitations where id = invitation;
  if not public.beta_code_available(lower(beta_code),upper(test_email)) then raise exception 'ASSERT: normalized invitation lookup failed'; end if;
  if public.beta_code_available(beta_code,'other@example.invalid') then raise exception 'ASSERT: mismatched email accepted'; end if;
  if has_table_privilege('anon','public.beta_invitations','SELECT') then raise exception 'ASSERT: public can list invitation codes'; end if;
  if has_column_privilege('anon','public.waitlist','status','INSERT') then raise exception 'ASSERT: anonymous request can choose status'; end if;
  if not has_column_privilege('anon','public.waitlist','email','INSERT') then raise exception 'ASSERT: public cannot request access'; end if;
  if has_function_privilege('authenticated','public.claim_beta_dispatch(uuid,uuid)','EXECUTE') then raise exception 'ASSERT: client can claim mail dispatch'; end if;
  perform public.claim_beta_dispatch(request_id,token);
  if public.finish_beta_dispatch(request_id,gen_random_uuid(),null) then raise exception 'ASSERT: wrong lease token accepted'; end if;
  if not public.finish_beta_dispatch(request_id,token,'QA disabled mail') then raise exception 'ASSERT: finish error rejected'; end if;
  if (select status from public.waitlist where id = request_id) <> 'error' then raise exception 'ASSERT: dispatch error not stored'; end if;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin
    insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values (gen_random_uuid(),'wrong@example.invalid',json_build_object('beta_code',beta_code),'{}');
    raise exception 'ASSERT: wrong email signup allowed';
  exception when invalid_parameter_value then null; end;
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values (requester_id,test_email,json_build_object('beta_code',lower(beta_code)),'{}');
  if public.beta_code_available(beta_code,test_email) then raise exception 'ASSERT: consumed invitation still available'; end if;
  if (select used_by_user_id from public.beta_invitations where id = invitation) <> requester_id then raise exception 'ASSERT: code consumed for wrong user'; end if;
  -- Free the Auth email uniqueness constraint so reuse reaches the beta trigger.
  update auth.users set email = 'qa-consumed-' || requester_id::text || '@example.invalid' where id = requester_id;
  begin
    insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values (gen_random_uuid(),test_email,json_build_object('beta_code',beta_code),'{}');
    raise exception 'ASSERT: invitation reused';
  exception when invalid_parameter_value then null; end;
  begin
    insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values (gen_random_uuid(),'no-code@example.invalid','{}','{}');
    raise exception 'ASSERT: code-free public signup allowed';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS: authorization, atomic approval, private code lookup, email binding, dispatch lease, signup consumption and reuse protection';
end $$;
rollback;
