import { useState } from "react";
import { Budget } from "@/types";
import { Button } from "@heroui/react";
import { updateBudget } from "@/features/budget/api/budgetRepository";
import { X, DollarSign, Percent, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

interface BudgetEditModalProps {
  budget: Budget;
  isOpen: boolean;
  onClose: () => void;
}

export function BudgetEditModal({ budget, isOpen, onClose }: BudgetEditModalProps) {
  const { runMutation } = usePrivateMutation();
  const [limit, setLimit] = useState(budget.limit_amount.toString());
  const [threshold, setThreshold] = useState(budget.alert_threshold?.toString() || '80');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'annual'>(budget.period);
  const [recurrent, setRecurrent] = useState(budget.recurrent);
  const [rollover, setRollover] = useState(budget.rollover);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNumberChange = (val: string, setter: (v: string) => void) => {
    const rawValue = val.replace(/\D/g, '');
    if (rawValue === '') {
      setter('');
      return;
    }
    const num = parseInt(rawValue, 10);
    setter(num.toString()); // Keep simple numbers for input value
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await runMutation(() => updateBudget(budget.id, {
        limit_amount: parseFloat(limit),
        alert_threshold: parseInt(threshold),
        period,
        recurrent,
        rollover
      }));
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl shadow-2xl w-full max-w-[440px] max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        <div className="p-5 border-b border-default-100 dark:border-border-subtle flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-foreground">Editar Presupuesto</h2>
          <button onClick={onClose} className="p-2 text-default-400 hover:bg-default-100 dark:hover:bg-surface-card rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto">

          {/* Límite Mensual */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-default-500 uppercase tracking-wider ml-1">Límite Mensual</label>
            <div className="flex items-center gap-3 bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent focus-within:border-[#6d28d9] transition-all">
              <DollarSign size={20} className="text-default-400" />
              <input
                type="text"
                value={limit ? parseInt(limit, 10).toLocaleString('es-CL') : ''}
                onChange={(e) => handleNumberChange(e.target.value, setLimit)}
                placeholder="0"
                className="bg-transparent border-none outline-none w-full text-xl font-bold text-foreground"
              />
            </div>
          </div>

          {/* Umbral de Alerta */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-default-500 uppercase tracking-wider ml-1">Umbral de Alerta (%)</label>
            <div className="flex items-center gap-3 bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent focus-within:border-[#6d28d9] transition-all">
              <input
                type="text"
                value={threshold}
                onChange={(e) => handleNumberChange(e.target.value, setThreshold)}
                placeholder="80"
                className="bg-transparent border-none outline-none w-full text-xl font-bold text-foreground"
              />
              <Percent size={20} className="text-default-400" />
            </div>
            <p className="text-xs text-default-500 ml-1">Este porcentaje activa la notificación anticipada; 0 la desactiva. El semáforo advierte desde 80% y marca exceso sobre 100%.</p>
          </div>

          {/* Periodo */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-default-500 uppercase tracking-wider ml-1">Período</label>
            <div className="grid grid-cols-3 gap-2 bg-default-50 dark:bg-surface-card p-1.5 rounded-2xl border border-transparent">
              <button
                type="button"
                onClick={() => setPeriod('weekly')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${period === 'weekly' ? 'bg-brand-primary text-white shadow-md' : 'text-default-500 hover:text-foreground'}`}
              >
                Semanal
              </button>
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${period === 'monthly' ? 'bg-brand-primary text-white shadow-md' : 'text-default-500 hover:text-foreground'}`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setPeriod('annual')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${period === 'annual' ? 'bg-brand-primary text-white shadow-md' : 'text-default-500 hover:text-foreground'}`}
              >
                Anual
              </button>
            </div>
          </div>

          {/* Switches */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent cursor-pointer hover:bg-default-100 transition-colors" onClick={() => setRecurrent(!recurrent)}>
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className={recurrent ? "text-[#6d28d9]" : "text-default-400"} />
                <span className="text-[15px] font-medium text-foreground">Presupuesto Recurrente</span>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${recurrent ? 'bg-brand-primary' : 'bg-default-200 dark:bg-default-100'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${recurrent ? 'transform translate-x-6' : ''}`} />
              </div>
            </div>

            <div className="flex items-center justify-between bg-default-50 dark:bg-surface-card p-4 rounded-2xl border border-transparent cursor-pointer hover:bg-default-100 transition-colors" onClick={() => setRollover(!rollover)}>
              <div className="flex items-center gap-3">
                <CalendarIcon size={20} className={rollover ? "text-[#6d28d9]" : "text-default-400"} />
                <span className="text-[15px] font-medium text-foreground">Acumular saldo no gastado</span>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${rollover ? 'bg-brand-primary' : 'bg-default-200 dark:bg-default-100'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${rollover ? 'transform translate-x-6' : ''}`} />
              </div>
            </div>
          </div>

        </div>

        <div className="p-5 border-t border-default-100 dark:border-border-subtle flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onPress={onClose} className="font-semibold border-transparent rounded-2xl">Cancelar</Button>
          <Button
            variant="ghost"
            className="bg-brand-primary text-white font-bold border-transparent hover:bg-brand-primary/90 rounded-2xl"
            isDisabled={isSubmitting}
            onPress={handleSave}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>

      </div>
    </div>
  );
}
