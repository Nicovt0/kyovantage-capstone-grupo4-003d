-- Staging only until explicit authorization to promote. No balances or transactions are modified.
begin;
alter table public.goals add column if not exists contribution_type text;
alter table public.goals add column if not exists contribution_amount numeric;
alter table public.goals add column if not exists reminders boolean not null default true;
-- Nullable historical plans remain unknown; do not fabricate historical monthly amounts.
alter table public.goals add constraint goals_contribution_type_valid
  check (contribution_type is null or contribution_type in ('auto','fixed','free')) not valid;
alter table public.goals add constraint goals_contribution_amount_valid
  check (contribution_amount is null or (contribution_amount>=0 and contribution_amount::text not in ('NaN','Infinity','-Infinity'))) not valid;
commit;
