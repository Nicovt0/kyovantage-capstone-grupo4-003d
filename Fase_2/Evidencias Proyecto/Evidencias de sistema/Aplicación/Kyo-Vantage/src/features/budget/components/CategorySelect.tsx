import { useState, type FormEvent, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { Tag, ShoppingCart, Coffee, Home, Car, Zap, Heart, Gift, Briefcase, GraduationCap, Monitor, Music, Plane, Dumbbell, Wine, Baby, Gamepad2, Wrench } from 'lucide-react';
import { TransactionSelect } from '@/features/wallet/components/transaction/TransactionSelect';
import { AppModal } from '@/shared/ui/AppModal';
import { addUserCustomCategory } from '@/features/settings/api/customEntitiesRepository';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { budgetQueryKeys } from '@/features/budget/model/queryKeys';

const icons={Tag,ShoppingCart,Coffee,Home,Car,Zap,Heart,Gift,Briefcase,GraduationCap,Monitor,Music,Plane,Dumbbell,Wine,Baby,Gamepad2,Wrench};

export function CategorySelect({type,...props}:Omit<ComponentProps<typeof TransactionSelect>,'onCreate'> & {type:'expense'|'income'}) {
  const [open,setOpen]=useState(false);
  return <><TransactionSelect {...props} onCreate={()=>setOpen(true)}/>
    {open && createPortal(<div className="relative z-[110]" onSubmit={event=>event.stopPropagation()}>
      <CategoryCreationModal type={type} onClose={()=>setOpen(false)} onCreated={id=>{props.onChange(id);setOpen(false);}}/>
    </div>,document.body)}
  </>;
}

export function CategoryCreationModal({type:fixedType,onClose,onCreated}:{type?:'expense'|'income';onClose:()=>void;onCreated:(id:string)=>void}) {
  const [name,setName]=useState('');
  const [icon,setIcon]=useState('Tag');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [selectedType,setSelectedType]=useState<'expense'|'income'>('expense');
  const type=fixedType || selectedType;
  const {auth}=useAuth();
  const {runMutation}=usePrivateMutation([budgetQueryKeys.categories(auth.id),queryKeys.budget.categories()]);
  async function save(event:FormEvent) {
    event.preventDefault();event.stopPropagation();
    if(saving || !name.trim()) return;
    setSaving(true);setError('');
    try {
      const category=await runMutation(()=>addUserCustomCategory(name.trim(),type,icon));
      if(!category) throw new Error('No se pudo crear la categoría.');
      onCreated(category.id);
    } catch(cause) {setError(cause instanceof Error ? cause.message : 'No se pudo crear la categoría.');setSaving(false);}
  }
  return <AppModal isOpen onClose={()=>{if(!saving)onClose();}} title="Crear categoría" icon={<Tag size={22} className="text-kyo-lightPurple"/>}>
    <form onSubmit={save} className="flex flex-col gap-5">
      {fixedType ? <p className="text-sm text-on-surface-card-secondary">Categoría de {type==='expense' ? 'gasto':'ingreso'}</p> : <fieldset>
        <legend className="mb-2 text-sm text-foreground">Tipo de categoría</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-raised/40 p-1.5">{([{id:'expense',name:'Gasto'},{id:'income',name:'Ingreso'}] as const).map(item=><button key={item.id} type="button" disabled={saving} aria-pressed={type===item.id} onClick={()=>setSelectedType(item.id)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${type===item.id ? item.id==='expense' ? 'border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : item.id==='expense' ? 'border-transparent text-rose-700 dark:text-rose-300 hover:bg-rose-500/10' : 'border-transparent text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'}`}>{item.name}</button>)}</div>
      </fieldset>}
      <label className="flex flex-col gap-2 text-sm text-foreground">Nombre
        <input autoFocus required maxLength={20} value={name} disabled={saving} onChange={event=>setName(event.target.value)} placeholder="Ej. Viajes" className="rounded-xl border border-border-subtle bg-surface-card p-3 outline-none focus:border-kyo-lightPurple"/>
      </label>
      <fieldset><legend className="mb-2 text-sm text-foreground">Icono</legend>
        <div className="grid grid-cols-6 gap-2">{Object.entries(icons).map(([key,Icon])=><button key={key} type="button" aria-label={`Icono ${key}`} aria-pressed={icon===key} disabled={saving} onClick={()=>setIcon(key)} className={`flex aspect-square items-center justify-center rounded-xl border focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${icon===key ? 'border-brand-primary bg-brand-primary/15 text-kyo-lightPurple' : 'border-border-subtle text-on-surface-card-secondary'}`}><Icon size={18}/></button>)}</div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-xl px-4 py-2 text-foreground">Cancelar</button>
        <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…':'Crear categoría'}</button>
      </div>
    </form>
  </AppModal>;
}
