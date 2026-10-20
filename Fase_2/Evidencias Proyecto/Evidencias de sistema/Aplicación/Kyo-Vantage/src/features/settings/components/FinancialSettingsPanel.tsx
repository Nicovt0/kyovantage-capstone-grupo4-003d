import { useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { useFinancialSettings, useSaveFinancialSettings } from '../hooks/useFinancialSettings';
import { financialCycleLabel, getFinancialCycle } from '@/utils/financialCycle';
import type { FinancialSettings } from '../api/financialSettingsRepository';
function FinancialSettingsForm({ initial }: { initial: FinancialSettings }) {
  const [day, setDay] = useState(initial.financial_cycle_start_day);
  const [income, setIncome] = useState(String(initial.monthly_estimated_income));
  const [message, setMessage] = useState('');
  const save = useSaveFinancialSettings();
  return <form className="flex flex-col gap-4" onSubmit={async event => {
    event.preventDefault(); setMessage('');
    try { await save.mutateAsync({ financial_cycle_start_day: day, monthly_estimated_income: Number(income) }); setMessage('Preferencias guardadas. Los resúmenes ya usan tu mes financiero.'); } catch { /* Mutation exposes the error below. */ }
  }}>
    <fieldset disabled={save.isPending} aria-describedby="financial-day-help" className="min-w-0 rounded-2xl border border-border-subtle p-3 md:p-4 disabled:opacity-60">
      <legend className="px-2 text-sm font-semibold">Inicio del mes financiero</legend>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-primary/40 bg-brand-primary/20 text-brand-primary dark:text-purple-400">
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          <span>Elige tu día de corte</span>
        </div>
        <span className="rounded-xl bg-brand-primary/15 px-3 py-1.5 text-sm font-semibold text-brand-primary dark:text-purple-300">Día {day} de cada mes</span>
      </div>
      <div className="grid max-w-lg grid-cols-7 gap-1.5 md:gap-2">
        {Array.from({ length: 31 }, (_, index) => {
          const value = index + 1;
          const selected = day === value;
          return <button
            key={value}
            type="button"
            aria-label={`Comenzar el mes financiero el día ${value}`}
            aria-pressed={selected}
            onClick={() => { setDay(value); setMessage(''); }}
            className={`relative flex h-11 items-center justify-center rounded-xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card disabled:cursor-wait md:h-12 ${selected ? 'border-[#8b5cf6] bg-[#8b5cf6]/20 font-bold text-foreground shadow-md shadow-[#8b5cf6]/20' : 'border-border-subtle bg-surface-card text-default-500 hover:border-brand-primary/50 hover:bg-brand-primary/10 hover:text-foreground'}`}
          >
            {value}
            {selected && <Check size={10} aria-hidden="true" className="absolute right-1 top-1 text-brand-primary dark:text-purple-300" />}
          </button>;
        })}
      </div>
      <p id="financial-day-help" className="mt-3 text-xs text-default-500">Selecciona un día del 1 al 31. Se repetirá cada mes; no necesitas elegir una fecha completa.</p>
    </fieldset>
    <p className="text-xs text-default-500">Tu período actual: {financialCycleLabel(getFinancialCycle(new Date(), day))}. En meses cortos se usa el último día disponible. El siguiente ciclo comienza ese mismo día de corte.</p>
    <label className="flex flex-col gap-2 text-sm">Ingreso mensual estimado (CLP)
      <input type="number" min="0" step="1" required inputMode="numeric" value={income} onChange={event => { setIncome(event.target.value); setMessage(''); }} className="rounded-xl border border-border-subtle bg-surface-card px-3 py-3" disabled={save.isPending} />
    </label>
    <p className="text-xs text-default-500">Referencia para planificar. No registra movimientos ni aumenta tu saldo. Usa 0 si no deseas configurarlo.</p>
    {save.error && <p role="alert" className="text-sm text-danger">{save.error.message}</p>}
    {message && <p role="status" className="text-sm text-default-500">{message}</p>}
    <button type="submit" disabled={save.isPending} className="rounded-xl bg-brand-primary text-white p-3 disabled:opacity-50">{save.isPending ? 'Guardando…' : 'Guardar preferencias financieras'}</button>
  </form>;
}
export function FinancialSettingsPanel() {
  const query = useFinancialSettings();
  if (query.isError) return <div role="alert"><p>{query.error.message}</p><button onClick={() => void query.refetch()}>Reintentar</button></div>;
  if (!query.data) return <p role="status">Cargando preferencias financieras…</p>;
  return <FinancialSettingsForm initial={query.data} />;
}
