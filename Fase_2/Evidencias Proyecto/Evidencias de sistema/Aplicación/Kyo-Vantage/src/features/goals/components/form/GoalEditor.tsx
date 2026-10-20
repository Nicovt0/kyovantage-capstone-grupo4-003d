import { queryKeys } from '@/lib/queryKeys';
import { useState, type FormEvent } from 'react';
import { Button } from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { Flag, Plane, Home, ShoppingCart, Shield, HeartPulse, Bus, BookOpen, TrendingUp, Coins, Laptop, GraduationCap, Calculator, SlidersHorizontal, Bell, BellOff } from 'lucide-react';
import type { Goal } from '@/types';
import { addGoal, updateGoal } from '@/features/goals/api/goalRepository';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { goalQueryKeys } from '@/features/goals/model/queryKeys';
import { calculateGoalPlan, localGoalDate, type ContributionType } from '@/features/goals/model/goalPlan';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { selectActiveAccounts } from '@/features/wallet/selectors/accountSelectors';
import { GoalDatePicker } from './GoalDatePicker';

const icons={Flag,Plane,Home,ShoppingCart,Shield,HeartPulse,Bus,BookOpen,TrendingUp,Coins,Laptop,GraduationCap};
const field='w-full rounded-xl border border-default-200 bg-default-100 p-3 text-sm text-foreground outline-none focus:border-brand-primary';
const label='flex flex-col gap-2 text-xs font-semibold text-default-500';
const modes=[{id:'auto',name:'Automático',Icon:Calculator,detail:'Elige una fecha y calculamos el abono mensual.'},
  {id:'fixed',name:'Fijo',Icon:Coins,detail:'Elige el abono mensual y calculamos cuándo llegas.'},
  {id:'free',name:'Flexible',Icon:SlidersHorizontal,detail:'Sin cuota mensual; sigue tu progreso y el tiempo restante.'}] as const;
const money=(amount:number)=>'$'+amount.toLocaleString('es-CL');
const dateLabel=(date:string)=>parseDate(date).toDate('America/Santiago').toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
const amountValue=(value:string)=>Number(value.replace(/\D/g,'')) || 0;
const formatted=(value:string)=>value.replace(/\D/g,'').slice(0,9).replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.');

export function GoalEditor({goal,onSaved,onCancel}:{goal?:Goal;onSaved:()=>void;onCancel:()=>void}) {
  const {auth}=useAuth();
  const accountsQuery=useAccounts();
  const savingsAccounts=selectActiveAccounts(accountsQuery.data || []).filter(account=>['savings','ahorro'].includes(account.type || ''));
  const [savingsAccountId,setSavingsAccountId]=useState(goal?.savings_account_id || '');
  const {runMutation}=usePrivateMutation([goalQueryKeys.all(auth.id),queryKeys.agenda.all]);
  const baseDate=localGoalDate();
  const [name,setName]=useState(goal?.name || '');
  const [target,setTarget]=useState(goal ? goal.target_amount.toLocaleString('es-CL') : '');
  const [current,setCurrent]=useState(goal ? goal.current_amount.toLocaleString('es-CL') : '0');
  const [deadline,setDeadline]=useState(goal?.deadline_date?.slice(0,10) || parseDate(baseDate).add({months:6}).toString());
  const [mode,setMode]=useState<ContributionType>(goal?.contribution_type || 'auto');
  const [fixed,setFixed]=useState(goal?.contribution_type==='fixed' ? goal.contribution_amount.toLocaleString('es-CL') : '');
  const [priority,setPriority]=useState<Goal['priority']>(goal?.priority || 'mid');
  const [color,setColor]=useState(goal?.color || '#6d28d9');
  const [icon,setIcon]=useState(goal?.icon_name || 'Flag');
  const [reminders,setReminders]=useState(goal?.reminders ?? true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const input={target:amountValue(target),current:amountValue(current),mode,fixed:amountValue(fixed),deadline,baseDate};
  let plan:ReturnType<typeof calculateGoalPlan> | null=null;
  let planError='';
  try {plan=calculateGoalPlan(input);} catch(cause) {planError=cause instanceof Error ? cause.message : 'Revisa el plan.';}

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(saving) return;
    setError('');
    try {
      if(!name.trim()) throw new Error('Escribe el nombre de la meta.');
      if(savingsAccountId && !savingsAccounts.some(account=>account.id===savingsAccountId)) throw new Error('Selecciona una cuenta de ahorro activa o desvincula la cuenta anterior.');
      const result=calculateGoalPlan(input);
      setSaving(true);
      const values={name:name.trim(),target_amount:input.target,savings_account_id:savingsAccountId || null,
        deadline_date:result.deadline,contribution_type:mode,contribution_amount:result.monthly,
        priority,color,icon_name:icon,reminders:mode==='free' ? false : reminders};
      const planChanged=!goal || input.target!==goal.target_amount || mode!==goal.contribution_type
        || (goal.contribution_type!=='free' && goal.contribution_amount<=0 && goal.current_amount<goal.target_amount)
        || (mode==='fixed' && input.fixed!==goal.contribution_amount)
        || (mode!=='fixed' && deadline!==goal.deadline_date.slice(0,10));
      await runMutation(()=>goal ? updateGoal(goal.id,planChanged ? values : {name:values.name,priority,color,icon_name:icon,reminders:values.reminders,savings_account_id:values.savings_account_id}) : addGoal({...values,current_amount:input.current,start_date:baseDate}));
      onSaved();
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la meta.');
    } finally {setSaving(false);}
  }
  return <form onSubmit={save} className="mx-auto flex w-full max-w-lg flex-col gap-5 text-foreground">
    <label className={label}>NOMBRE DE LA META *<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Fondo de emergencia, Viaje" className={field} /></label>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className={label}>MONTO OBJETIVO *<input required inputMode="numeric" value={target} onChange={e=>setTarget(formatted(e.target.value))} placeholder="$ 0" className={field} /></label>
      <label className={label}>{goal ? 'AHORRO ACUMULADO' : 'AHORRO INICIAL (OPCIONAL)'}<input inputMode="numeric" value={current} readOnly={Boolean(goal)} onChange={e=>setCurrent(formatted(e.target.value))} className={field} />{goal && <span>Se actualiza al registrar aportes.</span>}</label>
    </div>
    <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-xs font-semibold text-default-500">MODO DE ABONO</legend>
      <div role="group" aria-label="Modo de abono" aria-describedby="contribution-mode-detail" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-raised/40 p-1.5">
        {modes.map(({id,name:modeName,Icon})=><button key={id} type="button" aria-pressed={mode===id} onClick={()=>setMode(id)}
          className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${mode===id ? 'border-brand-primary bg-brand-primary/15 text-brand-primary dark:text-purple-300' : 'border-transparent text-on-surface-card-secondary hover:bg-surface-raised hover:text-on-background'}`}>
          <Icon size={18}/>{modeName}
        </button>)}
      </div>
      <p id="contribution-mode-detail" className="text-xs text-default-500">{modes.find(item=>item.id===mode)?.detail}</p>
    </fieldset>
    {mode==='fixed' ? <>
      <label className={label}>ABONO MENSUAL FIJO *<input required inputMode="numeric" value={fixed} onChange={e=>setFixed(formatted(e.target.value))} placeholder="Ej. 10.000" className={field} /></label>
      <div className="rounded-xl bg-default-100 p-3 text-sm"><span className="block text-xs text-default-500">FECHA OBJETIVO CALCULADA</span>{plan ? dateLabel(plan.deadline) : 'Ingresa el monto objetivo y el abono mensual.'}</div>
    </> : <GoalDatePicker value={deadline} min={mode==='auto' && input.target>input.current ? parseDate(baseDate).add({months:1}).toString() : baseDate} onChange={setDeadline} />}
    {input.target>0 && (plan ? <div role="status" className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3 text-sm">
      {mode==='free' ? <p>Sin cuota mensual. Fecha objetivo: {dateLabel(plan.deadline)}. Controlaremos tu progreso y el tiempo restante.</p> : plan.remaining===0 ? <p>Ya alcanzaste el monto objetivo.</p> : <>
        <p className="font-semibold">{money(plan.monthly)} al mes durante {plan.months} {plan.months===1 ? 'mes' : 'meses'}.</p>
        <p className="mt-1 text-xs">Primer abono: {plan.firstPayment && dateLabel(plan.firstPayment)}. Objetivo: {dateLabel(plan.deadline)}.</p>
        <p className="mt-1 text-xs">Pendiente: {money(plan.remaining)}.{plan.lastPayment!==plan.monthly && ` Último abono: ${money(plan.lastPayment)}.`} Los abonos empiezan el próximo mes; el plan no realiza débitos automáticos.</p>
      </>}
    </div> : <p role="status" className="text-sm text-warning">{planError}</p>)}
    <div className="flex flex-col gap-3 rounded-xl border border-default-200 bg-default-100 p-4">
      <label className="flex items-center justify-between text-xs text-default-500">IDENTIDAD VISUAL<input type="color" aria-label="Color de la meta" value={color} onChange={e=>setColor(e.target.value)} className="h-8 w-10 cursor-pointer bg-transparent" /></label>
      <div className="grid grid-cols-6 gap-2">{Object.entries(icons).map(([key,Icon])=><button key={key} type="button" aria-label={`Icono ${key}`} aria-pressed={icon===key} onClick={()=>setIcon(key)} className={`flex aspect-square items-center justify-center rounded-xl border ${icon===key ? 'border-brand-primary bg-brand-primary/20 text-kyo-lightPurple' : 'border-default-200 bg-default-50 text-default-500'}`}><Icon size={18}/></button>)}</div>
    </div>
    <fieldset><legend className="mb-2 text-xs font-semibold text-default-500">PRIORIDAD</legend>
      <div role="group" aria-label="Prioridad de la meta" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-raised/40 p-1.5">
        {([{id:'low',name:'Baja'},{id:'mid',name:'Media'},{id:'high',name:'Alta'}] as const).map(item=><button key={item.id} type="button" aria-pressed={priority===item.id} onClick={()=>setPriority(item.id)} className={`rounded-xl border px-1 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${priority===item.id ? 'border-brand-primary bg-brand-primary/15 text-brand-primary dark:text-purple-300' : 'border-transparent text-on-surface-card-secondary hover:bg-surface-raised hover:text-on-background'}`}>{item.name}</button>)}
      </div>
    </fieldset>
    <label className={label}>CUENTA DE AHORRO (OPCIONAL)
      <select value={savingsAccountId} onChange={e=>setSavingsAccountId(e.target.value)} disabled={accountsQuery.isLoading || accountsQuery.isError} className={field}>
        <option value="">Sin vincular cuenta</option>
        {savingsAccountId && !savingsAccounts.some(account=>account.id===savingsAccountId) && <option value={savingsAccountId}>Cuenta vinculada no disponible</option>}
        {savingsAccounts.map(account=><option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}
      </select>
      <span className="font-normal">{accountsQuery.isLoading ? 'Cargando cuentas…' : accountsQuery.isError ? 'No se pudieron cargar las cuentas.' : savingsAccounts.length===0 ? 'No tienes cuentas de ahorro activas.' : 'Vincular la cuenta no mueve dinero ni modifica el ahorro acumulado.'}</span>
    </label>
    {accountsQuery.isError && <button type="button" onClick={()=>void accountsQuery.refetch()} className="text-sm text-brand-primary">Reintentar cargar cuentas</button>}
    {mode!=='free' && <div className="flex items-center gap-3 rounded-xl border border-default-200 bg-default-100 p-4">
      <span className="rounded-xl bg-brand-primary/10 p-2 text-kyo-lightPurple">{reminders ? <Bell size={20}/> : <BellOff size={20}/>}</span>
      <div className="flex-1"><p id="goal-reminders-label" className="text-sm font-semibold">¿Activar recordatorios mensuales?</p><p id="goal-reminders-description" className="mt-1 text-xs text-default-500">Guardaremos tu preferencia. Los avisos automáticos aún no están disponibles.</p></div>
      <button type="button" role="switch" aria-checked={reminders} aria-labelledby="goal-reminders-label" aria-describedby="goal-reminders-description" onClick={()=>setReminders(!reminders)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${reminders ? 'bg-brand-primary' : 'bg-default-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${reminders ? 'left-1 translate-x-5' : 'left-1'}`}/></button>
    </div>}
    {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    <div className="flex justify-end gap-3 border-t border-default-200 pt-4">
      <Button type="button" variant="ghost" onPress={onCancel} isDisabled={saving}>Cancelar</Button>
      <Button type="submit" isDisabled={saving} className="bg-brand-primary font-bold text-white">{saving ? 'Guardando…' : goal ? 'Guardar cambios' : 'Crear meta'}</Button>
    </div>
  </form>;
}
