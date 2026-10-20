-- Solo staging. Sin nuevas tablas ni columnas. No modifica roles ni invitaciones.
begin;

create or replace function public.sync_auth_profile_identity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_name_changed boolean;
begin
  v_name := coalesce(nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'name')='string' then new.raw_user_meta_data->>'name' end)), ''),
    nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'full_name')='string' then new.raw_user_meta_data->>'full_name' end)), ''),
    nullif(btrim(concat_ws(' ', nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'first_name')='string' then new.raw_user_meta_data->>'first_name' end)), ''), nullif(btrim((case when jsonb_typeof(new.raw_user_meta_data->'last_name')='string' then new.raw_user_meta_data->>'last_name' end)), ''))), ''));
  if tg_op = 'INSERT' then
    v_name_changed := true;
  else
    v_name_changed := row((case when jsonb_typeof(new.raw_user_meta_data->'name')='string' then new.raw_user_meta_data->>'name' end),(case when jsonb_typeof(new.raw_user_meta_data->'full_name')='string' then new.raw_user_meta_data->>'full_name' end),(case when jsonb_typeof(new.raw_user_meta_data->'first_name')='string' then new.raw_user_meta_data->>'first_name' end),(case when jsonb_typeof(new.raw_user_meta_data->'last_name')='string' then new.raw_user_meta_data->>'last_name' end))
      is distinct from row((case when jsonb_typeof(old.raw_user_meta_data->'name')='string' then old.raw_user_meta_data->>'name' end),(case when jsonb_typeof(old.raw_user_meta_data->'full_name')='string' then old.raw_user_meta_data->>'full_name' end),(case when jsonb_typeof(old.raw_user_meta_data->'first_name')='string' then old.raw_user_meta_data->>'first_name' end),(case when jsonb_typeof(old.raw_user_meta_data->'last_name')='string' then old.raw_user_meta_data->>'last_name' end));
  end if;
  if v_name_changed then
    insert into public.profiles(id, full_name) values(new.id, v_name)
      on conflict (id) do update set full_name = coalesce(excluded.full_name, public.profiles.full_name);
  end if;
  -- Admin migrations have email; the reference schema does not. Reuse it if present.
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='email') then
    if tg_op = 'INSERT' then
      execute 'update public.profiles set email=$1 where id=$2' using new.email,new.id;
    elsif new.email is distinct from old.email then
      execute 'update public.profiles set email=$1 where id=$2' using new.email,new.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auth_profile_identity() from public, anon, authenticated;
drop trigger if exists zz_sync_auth_profile_identity on auth.users;
create trigger zz_sync_auth_profile_identity after insert or update of raw_user_meta_data,email
  on auth.users for each row execute function public.sync_auth_profile_identity();

-- Recover empty/default names only; preserve names already maintained in profiles.
with candidates as (
  select u.id, candidate.value from auth.users u
  cross join lateral (
    select btrim(value) as value from (values
      (1, (case when jsonb_typeof(u.raw_user_meta_data->'name')='string' then u.raw_user_meta_data->>'name' end)),
      (2, (case when jsonb_typeof(u.raw_user_meta_data->'full_name')='string' then u.raw_user_meta_data->>'full_name' end)),
      (3, concat_ws(' ', nullif(btrim((case when jsonb_typeof(u.raw_user_meta_data->'first_name')='string' then u.raw_user_meta_data->>'first_name' end)), ''), nullif(btrim((case when jsonb_typeof(u.raw_user_meta_data->'last_name')='string' then u.raw_user_meta_data->>'last_name' end)), '')))
    ) as names(priority,value)
    where nullif(btrim(value),'') is not null and lower(btrim(value)) not in ('usuario kyo','usuario')
    order by priority limit 1
  ) candidate
)
update public.profiles p set full_name=c.value from candidates c
  where p.id=c.id and (nullif(btrim(p.full_name),'') is null or lower(btrim(p.full_name)) in ('usuario kyo','usuario'));

do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='email') then
    execute $sql$update public.profiles p set email=u.email from auth.users u where p.id=u.id and nullif(btrim(p.email),'') is null and u.email is not null$sql$;
  end if;
end;
$$;
commit;
