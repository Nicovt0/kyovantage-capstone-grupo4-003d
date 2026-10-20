import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  Landmark,
  CreditCard as CreditCardIcon,
  Tag,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Repeat,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { Button, Spinner } from '@heroui/react';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import {
  RecurringTemplate,
  CreateRecurringTemplateDTO,
  UpdateRecurringTemplateDTO,
  RecurringFrequency,
  RecurringStatus,
  RecurringType,
} from '@/types';

interface AgendaEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateRecurringTemplateDTO | { id: string; updates: UpdateRecurringTemplateDTO }) => Promise<any>;
  initialData?: RecurringTemplate | null;
  defaultDay?: number;
}

export function AgendaEventModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultDay,
}: AgendaEventModalProps) {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: creditCards = [], isLoading: loadingCards } = useCreditCards();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'CLP' | 'UF' | 'USD'>('CLP');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [type, setType] = useState<RecurringType>('expense');
  const [status, setStatus] = useState<RecurringStatus>('pending');
  const [paymentDay, setPaymentDay] = useState<number>(defaultDay || 1);
  const [specificDate, setSpecificDate] = useState<string>('');

  // Payment instrument selection: 'none' | 'account' | 'card'
  const [instrumentType, setInstrumentType] = useState<'none' | 'account' | 'card'>('none');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isEditing = Boolean(initialData?.id);

  // Initialize form when opening or editing
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setTitle(initialData.name || initialData.title || '');
      const initialAmt = initialData.expected_amount ?? initialData.amount;
      setAmount(initialAmt ? Number(initialAmt).toLocaleString('es-CL') : '');
      setFrequency(initialData.frequency || 'monthly');
      setType(initialData.type || 'expense');
      setStatus(initialData.status === 'paid' ? 'pending' : (initialData.status || 'pending'));
      setPaymentDay(initialData.payment_day || initialData.day_of_month || defaultDay || 1);
      setSpecificDate(initialData.due_date ? String(initialData.due_date).split('T')[0] : '');

      if (initialData.credit_card_id) {
        setInstrumentType('card');
        setSelectedCardId(initialData.credit_card_id);
        setSelectedAccountId('');
      } else if (initialData.account_id) {
        setInstrumentType('account');
        setSelectedAccountId(initialData.account_id);
        setSelectedCardId('');
      } else {
        setInstrumentType('none');
        setSelectedAccountId('');
        setSelectedCardId('');
      }
    } else {
      // Default creation state
      setTitle('');
      setAmount('');
      setCurrency('CLP');
      setFrequency('monthly');
      setType('expense');
      setStatus('pending');
      setPaymentDay(defaultDay || new Date().getDate());
      setSpecificDate(new Date().toISOString().split('T')[0]);
      setInstrumentType('none');
      setSelectedAccountId('');
      setSelectedCardId('');
    }
    setErrorMessage('');
  }, [isOpen, initialData, defaultDay]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setAmount('');
      return;
    }
    const num = parseInt(raw, 10);
    setAmount(num.toLocaleString('es-CL'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage('Por favor ingresa un título para el compromiso.');
      return;
    }

    const numericAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    setIsSubmitting(true);

    try {
      let calculatedDueDate: string;
      if (frequency === 'monthly') {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const day = Math.max(1, Math.min(31, paymentDay));
        let targetYear = currentYear;
        let targetMonth = currentMonth;
        if (now.getDate() > day) {
          targetMonth += 1;
          if (targetMonth > 11) {
            targetMonth = 0;
            targetYear += 1;
          }
        }
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        calculatedDueDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
      } else {
        calculatedDueDate = specificDate || new Date().toISOString().split('T')[0];
      }

      const payload: CreateRecurringTemplateDTO = {
        title: cleanTitle,
        name: cleanTitle,
        amount: numericAmount,
        expected_amount: numericAmount,
        frequency,
        status: initialData?.payment_transaction_id ? undefined : status,
        type,
        payment_day: frequency === 'monthly' ? paymentDay : null,
        day_of_month: frequency === 'monthly' ? paymentDay : null,
        due_date: calculatedDueDate,
        next_due_date: calculatedDueDate,
        account_id: instrumentType === 'account' ? selectedAccountId || null : null,
        credit_card_id: instrumentType === 'card' ? selectedCardId || null : null,
        is_essential: true,
        is_active: true,
      };

      if (isEditing && initialData?.id) {
        await onSave({
          id: initialData.id,
          updates: payload,
        });
      } else {
        await onSave(payload);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving agenda event:', err);
      setErrorMessage(err.message || 'Ocurrió un error al guardar el compromiso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border-subtle bg-surface-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-foreground scrollbar-thin">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6d28d9] to-[#8b5cf6] flex items-center justify-center text-white shadow-lg shadow-[#6d28d9]/30">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isEditing ? 'Editar Compromiso' : 'Nuevo Compromiso en Agenda'}
              </h2>
              <p className="text-xs text-on-surface-card-secondary">
                {isEditing
                  ? 'Modifica los datos y medios de pago del compromiso programado.'
                  : 'Registra un pago periódico, cuota o cobro agendado.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-on-surface-card-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
          {/* Tipo de flujo (Gasto vs Ingreso) */}
          <div className="grid grid-cols-2 gap-2 bg-surface-input p-1.5 rounded-2xl border border-border-subtle">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                type === 'expense'
                  ? 'bg-gradient-to-r from-[#f43f5e] to-[#e11d48] text-white shadow-md shadow-red-500/20'
                  : 'text-on-surface-card-secondary hover:text-foreground'
              }`}
            >
              <span>Gasto / Pago Fijo</span>
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              disabled
              title="Registra ingresos desde Billetera"
              className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                type === 'income'
                  ? 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-md shadow-emerald-500/20'
                  : 'text-on-surface-card-secondary hover:text-foreground'
              }`}
            >
              <span>Ingreso Recurrente</span>
            </button>
          </div>

          {/* Título */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
              Nombre o Título *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Arriendo departamento, Netflix, Sueldo..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-border-subtle bg-surface-input p-3 text-sm text-foreground placeholder-gray-500 outline-none focus:border-[#8b5cf6] transition-colors"
            />
          </div>

          {/* Monto y Moneda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
                Monto *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-card-secondary font-bold text-sm">
                  $
                </span>
                <input
                  type="text"
                  required
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  className="w-full rounded-2xl border border-border-subtle bg-surface-input py-3 pl-8 pr-3 text-sm font-bold text-foreground placeholder-gray-500 outline-none focus:border-[#8b5cf6] transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full rounded-2xl border border-border-subtle bg-surface-input p-3 text-sm text-foreground outline-none focus:border-[#8b5cf6] transition-colors"
              >
                <option value="CLP">CLP ($)</option>
                <option value="UF">UF</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {/* Frecuencia y Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
                Frecuencia
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full rounded-2xl border border-border-subtle bg-surface-input p-3 text-sm text-foreground outline-none focus:border-[#8b5cf6] transition-colors"
              >
                <option value="monthly">Mensual (mismo día de cada mes)</option>
                <option value="yearly">Anual (una vez al año)</option>
                <option value="once">Pago único (fecha específica)</option>
              </select>
            </div>

            {frequency === 'monthly' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
                    Día de Cobro / Pago
                  </label>
                  <span className="text-xs font-bold text-[#f59e0b]">Día {paymentDay}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="31"
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(parseInt(e.target.value, 10))}
                  className="w-full accent-[#8b5cf6] h-2 bg-surface-raised rounded-lg cursor-pointer mt-3"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
                  Fecha de Vencimiento
                </label>
                <input
                  type="date"
                  required
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="w-full rounded-2xl border border-border-subtle bg-surface-input p-3 text-sm text-foreground outline-none focus:border-[#8b5cf6] transition-colors"
                />
              </div>
            )}
          </div>

          {/* Estado Inicial */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
              Estado del Compromiso
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  status === 'pending'
                    ? 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#f59e0b]'
                    : 'border-border-subtle bg-surface-input text-on-surface-card-secondary hover:text-foreground'
                }`}
              >
                <Clock size={14} />
                <span>Pendiente</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('paid')}
                disabled
                title="Registra el pago desde la agenda para actualizar el saldo"
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  status === 'paid'
                    ? 'border-[#10b981] bg-[#10b981]/20 text-emerald-700 dark:text-[#10b981]'
                    : 'border-border-subtle bg-surface-input text-on-surface-card-secondary hover:text-foreground'
                }`}
              >
                <CheckCircle2 size={14} />
                <span>Pagado</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('overdue')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  status === 'overdue'
                    ? 'border-[#ef4444] bg-[#ef4444]/20 text-[#ef4444]'
                    : 'border-border-subtle bg-surface-input text-on-surface-card-secondary hover:text-foreground'
                }`}
              >
                <AlertTriangle size={14} />
                <span>Vencido</span>
              </button>
            </div>
          </div>

          {/* Vinculación de Medio de Pago (Billetera Normalizada) */}
          <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-body flex items-center gap-1.5">
                <Landmark size={14} className="text-[#8b5cf6]" />
                Medio de Pago Asociado (Opcional)
              </label>
              <span className="text-[11px] text-on-surface-card-secondary">Billetera</span>
            </div>

            {/* Selector de tipo de instrumento */}
            <div className="grid grid-cols-3 gap-2 bg-surface-input p-1 rounded-2xl border border-border-subtle text-xs">
              <button
                type="button"
                onClick={() => setInstrumentType('none')}
                className={`py-1.5 rounded-xl font-medium transition-all ${
                  instrumentType === 'none'
                    ? 'bg-surface-raised text-foreground font-bold'
                    : 'text-on-surface-card-secondary hover:text-foreground'
                }`}
              >
                Sin vincular
              </button>
              <button
                type="button"
                onClick={() => setInstrumentType('account')}
                className={`py-1.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1 ${
                  instrumentType === 'account'
                    ? 'bg-brand-primary text-white font-bold'
                    : 'text-on-surface-card-secondary hover:text-foreground'
                }`}
              >
                <Landmark size={12} />
                <span>Cuenta Débito</span>
              </button>
              <button
                type="button"
                onClick={() => setInstrumentType('card')}
                className={`py-1.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1 ${
                  instrumentType === 'card'
                    ? 'bg-brand-primary text-white font-bold'
                    : 'text-on-surface-card-secondary hover:text-foreground'
                }`}
              >
                <CreditCardIcon size={12} />
                <span>Tarjeta Crédito</span>
              </button>
            </div>

            {/* Desplegable de Cuenta */}
            {instrumentType === 'account' && (
              <div className="animate-in fade-in duration-200">
                {loadingAccounts ? (
                  <div className="text-xs text-on-surface-card-secondary p-2">Cargando cuentas bancarias...</div>
                ) : accounts.length === 0 ? (
                  <div className="text-xs text-amber-700 dark:text-amber-400 p-2 bg-amber-400/10 rounded-xl">
                    No tienes cuentas bancarias registradas en la Billetera.
                  </div>
                ) : (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full rounded-2xl border border-border-subtle bg-surface-input p-3 text-sm text-foreground outline-none focus:border-[#8b5cf6] transition-colors"
                  >
                    <option value="">Selecciona una cuenta de débito</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} - Saldo: ${acc.balance.toLocaleString('es-CL')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Desplegable de Tarjeta de Crédito */}
            {instrumentType === 'card' && (
              <div className="animate-in fade-in duration-200">
                {loadingCards ? (
                  <div className="text-xs text-on-surface-card-secondary p-2">Cargando tarjetas de crédito...</div>
                ) : creditCards.length === 0 ? (
                  <div className="text-xs text-amber-700 dark:text-amber-400 p-2 bg-amber-400/10 rounded-xl">
                    No tienes tarjetas de crédito registradas en la Billetera.
                  </div>
                ) : (
                  <select
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="w-full rounded-2xl border border-border-subtle bg-surface-input p-3 text-sm text-foreground outline-none focus:border-[#8b5cf6] transition-colors"
                  >
                    <option value="">Selecciona una tarjeta de crédito</option>
                    {creditCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name} (Cupo: ${card.total_limit.toLocaleString('es-CL')})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle mt-2">
            <Button
              type="button"
              variant="flat"
              onPress={onClose}
              className="rounded-xl px-5 py-2.5 text-xs font-semibold text-on-surface-card-secondary hover:text-foreground bg-surface-raised"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] shadow-lg shadow-[#6d28d9]/30 hover:opacity-90 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" color="current" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>{isEditing ? 'Actualizar Compromiso' : 'Crear Compromiso'}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
