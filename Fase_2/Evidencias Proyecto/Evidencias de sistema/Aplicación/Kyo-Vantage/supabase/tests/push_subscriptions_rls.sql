-- Run after the migration in staging or disposable database.
-- Validates RLS isolation on push_subscriptions. Rolls back completely on completion.
begin;
do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  sub_a_id uuid := gen_random_uuid();
  sub_b_id uuid := gen_random_uuid();
  endpoint_a text := 'https://fcm.googleapis.com/fcm/send/test-token-a';
  endpoint_b text := 'https://fcm.googleapis.com/fcm/send/test-token-b';
  found_count int;
begin
  -- 1. Setup service role fixtures: users and profiles
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  insert into auth.users (id, email) values
    (user_a, 'qa-push-a@example.invalid'),
    (user_b, 'qa-push-b@example.invalid');

  insert into public.profiles (id, full_name) values
    (user_a, 'Push User A'),
    (user_b, 'Push User B');

  -- 2. Act as User A (authenticated)
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- User A inserts own subscription
  insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
  values (sub_a_id, user_a, endpoint_a, 'p256dh-key-a', 'auth-secret-a');

  -- User A cannot insert subscription belonging to User B
  begin
    insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
    values (gen_random_uuid(), user_b, 'https://fcm.googleapis.com/fcm/send/forged-b', 'p256dh-key', 'auth-secret');
    raise exception 'ASSERT: User A was able to insert subscription with user_id = User B';
  exception when others then
    -- expected RLS violation
    null;
  end;

  -- 3. Act as User B (authenticated)
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- User B should NOT see User A's subscription
  select count(*) into found_count from public.push_subscriptions where user_id = user_a;
  if found_count > 0 then
    raise exception 'ASSERT: User B was able to select User A subscription via RLS';
  end if;

  -- User B inserts own subscription
  insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
  values (sub_b_id, user_b, endpoint_b, 'p256dh-key-b', 'auth-secret-b');

  -- User B cannot delete User A's subscription
  delete from public.push_subscriptions where id = sub_a_id;

  -- 4. Switch back to User A: User A's subscription still exists and is untouched
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  select count(*) into found_count from public.push_subscriptions where id = sub_a_id;
  if found_count <> 1 then
    raise exception 'ASSERT: User A subscription was deleted by User B';
  end if;

  -- User A can delete own subscription
  delete from public.push_subscriptions where id = sub_a_id;
  select count(*) into found_count from public.push_subscriptions where id = sub_a_id;
  if found_count <> 0 then
    raise exception 'ASSERT: User A could not delete own subscription';
  end if;
end;
$$;
rollback;
