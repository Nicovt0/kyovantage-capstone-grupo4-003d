import { selectActiveAccounts } from '@/features/wallet/selectors/accountSelectors';
import { useState, useId } from 'react';
import { Button } from '@heroui/react';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import type { RecurringTemplate } from '@/types';
import { Landmark, Calendar, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';

export function AgendaPaymentModal({
  event,
  isPaying,
  onPay,
  onClose,
}: {
  event: RecurringTemplate;
  isPaying: boolean;
  onPay: (accountId: string, amount: number, savingsAccountId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const { data: accounts = [], isLoading, isError } = useAccounts();
  const activeAccounts = selectActiveAccounts(accounts);

  // Pre-select event account or first available active account
  const defaultAccountId =
    event.account_id && activeAccounts.some((a) => a.id === event.account_id)
      ? event.account_id
      : activeAccounts.length > 0
      ? activeAccounts[0].id
      : '';

  const [accountId, setAccountId] = useState(defaultAccountId);
  const [savingsAccountId,setSavingsAccountId]=useState('');
  const fixedPlan=Boolean(event.goal_id && event.contribution_type!=='free');

  // Initial amount from template
  const initialAmount = Number(event.amount ?? event.expected_amount ?? 0);
  const [amountInput, setAmountInput] = useState(
    initialAmount > 0 ? String(initialAmount) : ''
  );
  const [error, setError] = useState('');

  const accountSelectId = useId();
  const amountInputId = useId();

  const selectedAccount = activeAccounts.find((account) => account.id === accountId);
  const numericAmount = Math.max(0, parseInt(amountInput.replace(/\D/g, ''), 10) || 0);

  const currentBalance = selectedAccount ? Number(selectedAccount.balance) : 0;
  const projectedBalance = currentBalance - numericAmount;
  const isInsufficient = selectedAccount ? numericAmount > currentBalance : false;

  const handleConfirm = async () => {
    setError('');
    if (!accountId) {
      setError('Por favor selecciona una cuenta para descontar el pago.');
      return;
    }
    if (savingsAccountId===accountId) { setError('Selecciona dos cuentas distintas.'); return; }
    if (!numericAmount || numericAmount <= 0) {
      setError('Por favor ingresa un monto válido mayor a $0.');
      return;
    }

    try {
      await onPay(accountId, numericAmount, savingsAccountId || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && !isPaying && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-payment-title"
        className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface-card p-6 text-foreground space-y-5 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="agenda-payment-title" className="text-lg font-bold text-foreground">
                Confirmar Pago de Compromiso
              </h2>
              <p className="text-xs text-on-surface-card-secondary">
                {event.title || event.name} · {event.frequency === 'monthly' ? 'Mensual' : event.frequency === 'yearly' ? 'Anual' : 'Único'}
              </p>
            </div>
          </div>
        </div>

        {/* Commitment Summary Info */}
        <div className="bg-surface-input border border-border-subtle rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-on-surface-card-secondary">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="text-purple-400" />
              Fecha de vencimiento:
            </span>
            <span className="text-foreground font-medium">{event.due_date || 'Mes en curso'}</span>
          </div>
          {event.credit_card_id && (
            <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 mt-1">
              Este compromiso está vinculado a una tarjeta. Selecciona la cuenta bancaria de donde pagas; este registro debitará tu saldo disponible.
            </p>
          )}
        </div>

        {/* Amount Input (Variable / Fixed confirmation) */}
        <div className="space-y-1.5">
          <label htmlFor={amountInputId} className="block text-xs font-semibold uppercase tracking-wider text-on-surface-card-body">
            Monto a Pagar ($ CLP)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-700 dark:text-emerald-400 pointer-events-none" />
            <input
              id={amountInputId}
              type="text"
              inputMode="numeric"
              readOnly={fixedPlan}
              disabled={isPaying}
              value={numericAmount > 0 ? numericAmount.toLocaleString('es-CL') : ''}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0"
              className="w-full bg-surface-input border border-border-subtle focus:border-emerald-500 rounded-xl pl-9 pr-4 py-2.5 text-base font-bold text-foreground transition-all outline-none"
            />
          </div>
          <p className="text-[11px] text-on-surface-card-secondary">
            {event.goal_id ? (fixedPlan ? 'El monto corresponde al plan vigente de la meta.' : 'Elige el monto de tu aporte flexible.') : 'Si la boleta es variable (luz, agua, gas), confirma o ajusta aquí el monto exacto facturado.'}
          </p>
        </div>

        {/* Payment Account Selector */}
        <div className="space-y-1.5">
          <label htmlFor={accountSelectId} className="block text-xs font-semibold uppercase tracking-wider text-on-surface-card-body flex items-center gap-1.5">
            <Landmark size={13} className="text-purple-400" />
            Cuenta de Origen
          </label>
          <select
            id={accountSelectId}
            value={accountId}
            onChange={(e) => {setAccountId(e.target.value);if(e.target.value===savingsAccountId)setSavingsAccountId('');}}
            disabled={isLoading || isPaying}
            className="w-full bg-surface-input border border-border-subtle focus:border-purple-500 rounded-xl p-3 text-sm text-foreground transition-all outline-none"
          >
            <option value="">Selecciona una cuenta</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · Saldo actual: ${Number(account.balance || 0).toLocaleString('es-CL')}
              </option>
            ))}
          </select>

          {/* Balance impact preview */}
          {selectedAccount && numericAmount > 0 && (
            <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
              isInsufficient
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <span>Saldo tras pago:</span>
              <strong className="text-sm font-bold">
                ${projectedBalance.toLocaleString('es-CL')}
              </strong>
            </div>
          )}
        </div>

        {event.goal_id && <div className="space-y-2 text-xs text-on-surface-card-body">
          <p>{fixedPlan ? 'Monto calculado por el plan de la meta. Para cambiarlo, edita la meta.' : 'Aporte flexible: define cuánto deseas ahorrar este mes.'}</p>
          <label className="block">Cuenta de destino (opcional)
            <select aria-label="Cuenta de destino del ahorro" value={savingsAccountId} onChange={e=>setSavingsAccountId(e.target.value)} disabled={isPaying} className="mt-2 w-full rounded-xl border border-border-subtle bg-surface-input p-3 text-foreground">
              <option value="">Solo registrar el aporte, sin transferencia interna</option>
              {activeAccounts.filter(account=>account.id!==accountId).map(account=><option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <p>El aporte aumenta la meta una sola vez. Si eliges destino, también se transfiere el dinero a esa cuenta.</p>
        </div>}

        {/* Error notices */}
        {isError && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
            No se pudieron cargar las cuentas bancarias.
          </p>
        )}
        {!isLoading && !isError && !activeAccounts.length && (
          <p className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            No tienes cuentas activas en Billetera. Crea una cuenta para poder registrar este pago.
          </p>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
            <AlertCircle size={14} className="shrink-0 text-red-700 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2">
          <Button
            type="button"
            onPress={onClose}
            isDisabled={isPaying}
            className="bg-surface-raised hover:bg-surface-raised text-on-surface-card-body text-xs font-semibold rounded-xl px-4 py-2 border border-border-subtle"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            color="success"
            isLoading={isPaying}
            isDisabled={isPaying || !selectedAccount || isError || isInsufficient || numericAmount <= 0}
            onPress={handleConfirm}
            className="bg-gradient-to-r from-[#10b981] to-[#059669] hover:opacity-95 text-white text-xs font-bold rounded-xl px-5 py-2 shadow-lg shadow-emerald-500/20"
          >
            Confirmar pago
          </Button>
        </div>
      </section>
    </div>
  );
}
