-- Staging: optional destination preference; never transfers money on its own.
begin;
alter table public.goals add column if not exists savings_account_id uuid
  references public.accounts(id) on delete set null;

create or replace function public.validate_goal_savings_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.savings_account_id is not null and (
    tg_op = 'INSERT' or new.savings_account_id is distinct from old.savings_account_id
    or new.user_id is distinct from old.user_id
  ) then
    if not exists (
      select 1 from public.accounts a where a.id = new.savings_account_id
        and a.user_id = new.user_id and a.type = 'savings'
        and coalesce((to_jsonb(a)->>'is_active')::boolean, true) and not coalesce(a.is_archived, false)
    ) then
      raise exception 'Selecciona una cuenta de ahorro activa de tu usuario.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_goal_savings_account() from public, anon, authenticated;
drop trigger if exists trg_validate_goal_savings_account on public.goals;
create trigger trg_validate_goal_savings_account before insert or update on public.goals
for each row execute function public.validate_goal_savings_account();
commit;
