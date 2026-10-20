-- Staging: reject new retroactive recurring receipts without modifying paid history.
begin;
create or replace function public.validate_agenda_recurrence_creation()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_template public.recurring_templates;
begin
  if new.receipt_type='agenda' and new.goal_id is null and new.template_id is not null then
    select * into v_template from public.recurring_templates where id=new.template_id;
    if found and v_template.frequency is distinct from 'once'
      and new.occurrence_date < coalesce((v_template.created_at at time zone 'America/Santiago')::date,v_template.next_due_date) then
      raise exception 'El compromiso no puede repetirse antes de su fecha de creación.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_agenda_recurrence_creation() from public,anon,authenticated;
drop trigger if exists trg_validate_agenda_recurrence_creation on public.agenda_occurrence_payments;
create trigger trg_validate_agenda_recurrence_creation before insert on public.agenda_occurrence_payments
for each row execute function public.validate_agenda_recurrence_creation();
commit;
