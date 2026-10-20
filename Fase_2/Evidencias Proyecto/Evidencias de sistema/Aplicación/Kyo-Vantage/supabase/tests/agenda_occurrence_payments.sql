-- Run only in an isolated test database after the migration. All fixtures roll back.
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000024'),
  ('00000000-0000-0000-0000-000000000025');
insert into public.accounts(id,user_id,name,type,balance) values
  ('00000000-0000-0000-0001-000000000024','00000000-0000-0000-0000-000000000024','Agenda test','cash',1000),
  ('00000000-0000-0000-0001-000000000025','00000000-0000-0000-0000-000000000025','Other user','cash',1000);
insert into public.recurring_templates(id,user_id,name,expected_amount,frequency,day_of_month,next_due_date,status) values
  ('00000000-0000-0000-0002-000000000024','00000000-0000-0000-0000-000000000024','Agenda payment test',100,'monthly',31,'2026-01-31','pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000024","app_metadata":{"role":"user"}}', true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000024',true);
do $$
declare v_first uuid; v_retry uuid; v_rejected boolean;
begin
  v_first := public.pay_agenda_occurrence('00000000-0000-0000-0002-000000000024','2026-02-28','00000000-0000-0000-0001-000000000024');
  v_retry := public.pay_agenda_occurrence('00000000-0000-0000-0002-000000000024','2026-02-28','00000000-0000-0000-0001-000000000024');
  if v_first <> v_retry then raise exception 'Retry created a different transaction'; end if;
  if (select balance from public.accounts where id='00000000-0000-0000-0001-000000000024') <> 900 then raise exception 'Wrong or repeated debit'; end if;
  if (select count(*) from public.agenda_occurrence_payments where template_id='00000000-0000-0000-0002-000000000024') <> 1 then raise exception 'Duplicate payment'; end if;
  if (select status from public.recurring_templates where id='00000000-0000-0000-0002-000000000024') <> 'pending' then raise exception 'Global template status changed'; end if;
  v_rejected := false;
  begin
    perform public.pay_agenda_occurrence('00000000-0000-0000-0002-000000000024','2026-03-30','00000000-0000-0000-0001-000000000024');
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'Invalid occurrence accepted'; end if;
  v_rejected := false;
  begin
    perform public.pay_agenda_occurrence('00000000-0000-0000-0002-000000000024','2026-03-31','00000000-0000-0000-0001-000000000025');
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'Foreign account accepted'; end if;
  if (select balance from public.accounts where id='00000000-0000-0000-0001-000000000024') <> 900 then raise exception 'Failed operation changed balance'; end if;
  perform public.pay_agenda_occurrence('00000000-0000-0000-0002-000000000024','2026-03-31','00000000-0000-0000-0001-000000000024');
  if (select balance from public.accounts where id='00000000-0000-0000-0001-000000000024') <> 800 then raise exception 'Next month could not be paid independently'; end if;
end;
$$;
rollback;
select 'PASS: agenda idempotency, occurrence dates, owner checks and single debit; fixtures rolled back' as result;
