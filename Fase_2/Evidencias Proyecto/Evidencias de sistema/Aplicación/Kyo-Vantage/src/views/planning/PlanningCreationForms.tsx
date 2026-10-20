import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@heroui/react';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';
import { addBudget } from '@/features/budget/api/budgetRepository';
import { GoalEditor } from '@/features/goals/components/form/GoalEditor';
import type { Category } from '@/types';

const fieldClassName = 'w-full rounded-xl border border-white/10 bg-surface-card px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b5cf6]';
const labelClassName = 'flex flex-col gap-1.5 text-xs font-semibold text-gray-300';

export function BudgetCreationForm({ categories, onCancel, onSaved }: {
  categories: Category[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { runMutation } = usePrivateMutation();
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [recurrent, setRecurrent] = useState(true);
  const [rollover, setRollover] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const expenseCategories = categories.filter(category => category.type === 'expense');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(limitAmount);
    if (!categoryId || !Number.isFinite(amount) || amount <= 0) return;

    setError('');
    setIsSaving(true);
    try {
      await runMutation(() => addBudget({
        category_id: categoryId,
        limit_amount: amount,
        period,
        recurrent,
        rollover,
        alert_threshold: alertThreshold,
        start_date: new Date().toISOString(),
      }));
      onSaved();
    } catch (cause) {
      console.error('Error adding budget:', cause);
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el presupuesto. Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-lg flex-col gap-5 pb-6">
      <label className={labelClassName}>
        Categoría de gasto
        <select required value={categoryId} onChange={event => setCategoryId(event.target.value)} className={fieldClassName}>
          <option value="">Selecciona una categoría</option>
          {expenseCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>

      <label className={labelClassName}>
        Monto límite
        <input required min="1" step="1" type="number" value={limitAmount} onChange={event => setLimitAmount(event.target.value)} className={fieldClassName} placeholder="Ej. 150000" />
      </label>

      <label className={labelClassName}>
        Período
        <select value={period} onChange={event => setPeriod(event.target.value as typeof period)} className={fieldClassName}>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensual</option>
          <option value="annual">Anual</option>
        </select>
      </label>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="planning-budget-threshold" className="text-xs font-semibold text-gray-300">Alerta anticipada: {alertThreshold}%</label>
          <span className="text-[11px] text-gray-500">0% desactiva la alerta anticipada</span>
        </div>
        <input
          id="planning-budget-threshold"
          type="range"
          min="0"
          max="100"
          step="1"
          value={alertThreshold}
          onChange={event => setAlertThreshold(Number(event.target.value))}
          className="w-full accent-[#8b5cf6]"
        />
        <p className="text-[11px] text-gray-500">El semáforo muestra advertencia desde 80% y presupuesto superado sobre 100%. Este umbral configura la notificación anticipada.</p>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
        Renovar presupuesto al terminar el período
        <input type="checkbox" checked={recurrent} onChange={event => setRecurrent(event.target.checked)} className="h-4 w-4 accent-[#8b5cf6]" />
      </label>
      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
        Acumular saldo no gastado
        <input type="checkbox" checked={rollover} onChange={event => setRollover(event.target.checked)} className="h-4 w-4 accent-[#8b5cf6]" />
      </label>

      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onPress={onCancel} className="border-transparent text-gray-300">Cancelar</Button>
        <Button type="submit" isDisabled={isSaving || expenseCategories.length === 0} className="bg-brand-primary font-bold text-white">
          {isSaving ? 'Guardando...' : 'Crear presupuesto'}
        </Button>
      </div>
    </form>
  );
}

export function GoalCreationForm({onCancel,onSaved}:{onCancel:()=>void;onSaved:()=>void}) {
  return <GoalEditor onCancel={onCancel} onSaved={onSaved}/>;
}
