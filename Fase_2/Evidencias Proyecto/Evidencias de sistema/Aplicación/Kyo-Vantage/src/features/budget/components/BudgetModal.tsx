import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@heroui/react';
import { Coins, Tag, Bell } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { CategorySelect } from './CategorySelect';
import { AppModal } from '@/shared/ui/AppModal';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';
import { addBudget } from '@/features/budget/api/budgetRepository';
import type { Category } from '@/types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
}

export function BudgetModal({ isOpen, onClose, onSaved, categories }: BudgetModalProps) {
  const { runMutation } = usePrivateMutation();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const expenseCategories = categories.filter(category => category.type === 'expense');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawAmount = parseInt(limitAmount.replace(/\D/g, ''), 10);
    if (!selectedCategory || isNaN(rawAmount) || rawAmount <= 0) return;

    setError('');
    setIsSaving(true);
    try {
      await runMutation(() => addBudget({
        category_id: selectedCategory,
        limit_amount: rawAmount,
        period,
        alert_threshold: alertThreshold,
        recurrent: true,
        rollover: false,
        start_date: new Date().toISOString(),
      }));
      onSaved();
      onClose();
    } catch (cause) {
      console.error('Error al crear presupuesto:', cause);
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el presupuesto. Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir Presupuesto"
      icon={<Coins size={22} className="text-[#6d28d9]" />}
    >
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Categoría */}
          <CategorySelect type="expense" label="Categoría de gasto" value={selectedCategory} onChange={setSelectedCategory} disabled={isSaving} placeholder="Selecciona una categoría"
            options={expenseCategories.map(category=>{
              const Icon=(LucideIcons as unknown as Record<string,typeof Tag>)[category.icon_name || ''] || Tag;
              return {id:category.id,name:category.name,icon:<Icon size={17} className="text-on-surface-card-secondary"/>};
            })}/>

          {/* Monto Límite */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget-limit-amount-input" className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
              Monto Límite *
            </label>
            <div className="flex items-center rounded-xl border border-border-subtle bg-surface-card px-3.5 py-3 focus-within:border-[#8b5cf6] transition-colors">
              <span className="text-lg font-bold text-[#8b5cf6] mr-2">$</span>
              <input
                id="budget-limit-amount-input"
                required
                value={limitAmount}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  const num = parseInt(raw, 10);
                  if (!isNaN(num) && num > 999999999) return;
                  setLimitAmount(isNaN(num) ? '' : num.toLocaleString('es-CL'));
                }}
                placeholder="Ej. 150.000"
                className="w-full bg-transparent text-lg font-bold text-foreground outline-none"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">Período de evaluación</legend>
            <div role="group" aria-label="Período de evaluación" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-raised/40 p-1.5">
              {([{id:'weekly',name:'Semanal'},{id:'monthly',name:'Mensual'},{id:'annual',name:'Anual'}] as const).map(item=><button key={item.id} type="button" disabled={isSaving} aria-pressed={period===item.id} onClick={()=>setPeriod(item.id)} className={`rounded-xl border px-1 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${period===item.id ? 'border-brand-primary bg-brand-primary/15 text-brand-primary dark:text-purple-300' : 'border-transparent text-on-surface-card-secondary hover:bg-surface-raised hover:text-on-background'}`}>{item.name}</button>)}
            </div>
          </fieldset>

          {/* Umbral de Alerta Semáforo */}
          <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="budget-alert-threshold" className="text-xs font-semibold text-on-surface-card-body">
                Alerta de consumo
              </label>
              <span className="flex items-center gap-1.5 rounded-lg bg-brand-primary/15 px-2 py-1 text-sm font-semibold text-brand-primary dark:text-purple-300">
                <Bell size={14}/>{alertThreshold}%
              </span>
            </div>
            <input
              id="budget-alert-threshold"
              type="range"
              min="50"
              max="100"
              step="5"
              value={alertThreshold}
              onChange={e => setAlertThreshold(Number(e.target.value))}
              disabled={isSaving}
              aria-valuetext={`${alertThreshold}% del presupuesto consumido`}
              className="w-full accent-brand-primary cursor-pointer"
            />
            <div aria-hidden="true" className="flex justify-between text-[11px] text-on-surface-card-secondary"><span>50%</span><span>100%</span></div>
            <p className="text-[11px] text-on-surface-card-secondary">
              Define cuándo recibir la alerta de consumo. El semáforo mantiene la advertencia desde 80% y el exceso sobre 100%.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle mt-2">
            <Button
              type="button"
              variant="ghost"
              onPress={onClose}
              className="border-transparent text-on-surface-card-body hover:bg-surface-raised rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isDisabled={isSaving || expenseCategories.length === 0}
              className="bg-brand-primary font-bold text-white hover:bg-[#5b21b6] px-6 rounded-2xl"
            >
              {isSaving ? 'Guardando...' : 'Crear Presupuesto'}
            </Button>
          </div>
        </form>
    </AppModal>
  );
}
