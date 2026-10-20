import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinancialPeriod } from '@/features/app-shell/components/FinancialPeriodProvider';
import { financialCycleLabel } from '@/utils/financialCycle';

export function FinancialPeriodNavigator({showCurrentValuesNote=true}:{showCurrentValuesNote?:boolean}) {
  const {cycle,isCurrent,previous,next,reset}=useFinancialPeriod();
  return <section aria-label="Navegador de mes financiero" className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-card px-3 py-3 sm:px-4">
      <div className="flex flex-1 items-center justify-center gap-1 sm:flex-none sm:gap-3">
        <button type="button" aria-label="Mes financiero anterior" onClick={previous} className="rounded-xl p-2 text-foreground hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-kyo-lightPurple"><ChevronLeft size={20}/></button>
        <span role="status" aria-live="polite" className="min-w-0 text-center text-sm font-semibold text-foreground">{financialCycleLabel(cycle)}</span>
        <button type="button" aria-label="Mes financiero siguiente" onClick={next} className="rounded-xl p-2 text-foreground hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-kyo-lightPurple"><ChevronRight size={20}/></button>
      </div>
      <button type="button" onClick={reset} disabled={isCurrent} className="rounded-xl bg-brand-primary/10 px-3 py-2 text-xs font-semibold text-brand-primary dark:text-purple-300 disabled:opacity-50">Mes actual</button>
    </div>
    {!isCurrent && showCurrentValuesNote && <p className="px-1 text-xs text-on-surface-card-secondary">Movimientos y presupuestos del período seleccionado. Saldos, cupos y avance de metas muestran su estado actual.</p>}
  </section>;
}
