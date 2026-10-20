import { selectActiveAccounts, selectTransactionAccounts } from '@/features/wallet/selectors/accountSelectors';
import { useAccountingAction } from '@/features/accounting/hooks/useAccountingAction';
import { useState, type FormEvent } from 'react';
import { Button } from '@heroui/react';
import { ArrowRightLeft, ArrowUpRight, ArrowDownLeft, NotebookPen, Landmark, Wallet, CreditCard, Tag } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { TransactionSelect } from './TransactionSelect';
import { CategorySelect } from '@/features/budget/components/CategorySelect';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { addCreditCardPurchase } from '@/features/credit-cards/api/creditCardRepository';
import { AppModal } from '@/shared/ui/AppModal';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { addTransaction } from '@/features/wallet/api/transactionRepository';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const labelClass = 'text-xs font-medium text-on-surface-card-secondary';
const inputClass = 'w-full min-w-0 rounded-xl border border-border-subtle bg-surface-card px-3.5 py-3 text-sm text-on-background outline-none placeholder:text-on-surface-card-secondary/70 focus:border-kyo-lightPurple focus:ring-2 focus:ring-brand-primary/15 transition-colors';

export function TransactionModal({ isOpen, onClose }: TransactionModalProps) {
  const { runMutation } = usePrivateMutation();
  const runAccounting = useAccountingAction();
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const cardsQuery = useCreditCards({ enabled: isOpen });

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [installments, setInstallments] = useState('1');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const activeAccounts = selectActiveAccounts(accountsQuery.data || []);
  const accounts = selectTransactionAccounts(activeAccounts, type);
  const cards = (cardsQuery.data || []).filter(card => !card.is_archived);
  const selectedCard = type === 'expense' && accountId.startsWith('card:') ? cards.find(card => `card:${card.id}` === accountId) : undefined;
  const accountOptions = accounts.map(account => ({ id: account.id, name: account.name, detail: `Saldo: $${account.balance.toLocaleString('es-CL')}`, icon: account.bank_id ? <Landmark size={17} style={{ color: account.color || '#C4B5FD' }} /> : <Wallet size={17} style={{ color: account.color || '#C4B5FD' }} /> }));
  const instrumentOptions = [...accountOptions, ...(type === 'expense' ? cards.map(card => ({ id: `card:${card.id}`, name: card.name, detail: `Crédito · Cupo: $${Math.max(0, card.total_limit - (card.current_debt || 0)).toLocaleString('es-CL')}`, icon: <CreditCard size={17} className="text-kyo-lightPurple" /> })) : [])];
  const categories = (categoriesQuery.data || []).filter(category => category.type === type);
  const isLoading = accountsQuery.isLoading || categoriesQuery.isLoading || cardsQuery.isLoading;
  const loadError = accountsQuery.isError || categoriesQuery.isError || cardsQuery.isError;

  const resetForm = () => {
    setType('expense');
    setAccountId('');
    setDestinationAccountId('');
    setCategoryId('');
    setName('');
    setAmount('');
    setNote('');
    setInstallments('1');
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setError('');

    const account = accounts.find(item => item.id === accountId);
    const numericAmount = Number(amount);
    if ((!account && !selectedCard) || (type !== 'transfer' && !categories.some(item => item.id === categoryId)) || !name.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Completa la cuenta, categoría, descripción y un monto mayor a cero.');
      return;
    }
    if (!selectedCard && account && type !== 'income' && numericAmount > account.balance) {
      setError(`Saldo insuficiente: esta cuenta tiene $${account.balance.toLocaleString('es-CL')}.`);
      return;
    }
    if (selectedCard && (numericAmount > Math.max(0, selectedCard.total_limit - (selectedCard.current_debt || 0)))) {
      setError('El monto supera el cupo disponible de la tarjeta.'); return;
    }
    if (selectedCard && (!Number.isInteger(Number(installments)) || Number(installments) < 1 || Number(installments) > 99 || Number(installments) > numericAmount)) {
      setError('Elige entre 1 y 99 cuotas, con al menos $1 por cuota.'); return;
    }
    if (type === 'transfer' && (!accounts.some(item => item.id === destinationAccountId) || destinationAccountId === accountId)) {
      setError('Selecciona una cuenta destino activa distinta de la cuenta de origen.');
      return;
    }
    const selectedDate = new Date(`${date}T12:00:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
      setError('Elige una fecha válida hasta hoy. Los pagos futuros se registran en Agenda.');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedCard) {
        const purchase = { credit_card_id: selectedCard.id, category_id: categoryId, name: name.trim(), amount_total: numericAmount,
          installment_total: Number(installments), installment_current: 1, amount_per_installment: Math.floor(numericAmount / Number(installments)), purchase_date: selectedDate.toISOString(), status: 'active' as const };
        await runMutation(() => runAccounting(purchase, requestId => addCreditCardPurchase(purchase, requestId)));
        resetForm(); onClose(); return;
      }
      const payload = {
        account_id: accountId,
        category_id: type === 'transfer' ? undefined : categoryId, destination_account_id: type === 'transfer' ? destinationAccountId : undefined,
        name: name.trim(),
        amount: numericAmount,
        type,
        date: selectedDate.toISOString(),
        status: 'paid',
        note: note.trim() || undefined,
      } as const;
      await runMutation(() => runAccounting(payload, requestId => addTransaction(payload, false, requestId)));
      resetForm();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento.');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <AppModal isOpen={isOpen} onClose={() => { if (!isSaving) onClose(); }} title="Añadir movimiento" maxWidthClass="max-w-md [scrollbar-width:thin] dark:[color-scheme:dark]">
      {isLoading ? <p className="py-8 text-center text-sm text-on-surface-card-secondary">Cargando cuentas y categorías…</p>
        : loadError ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">No se pudieron cargar las cuentas o categorías. Cierra e inténtalo nuevamente.</p>
        : activeAccounts.length === 0 && cards.length === 0 ? <p className="py-4 text-center text-sm text-on-surface-card-secondary">Añade una cuenta o tarjeta en Billetera antes de registrar movimientos.</p>
        : <form onSubmit={handleSubmit}>
          <fieldset disabled={isSaving} className="flex min-w-0 flex-col gap-3 disabled:opacity-70">
            <div className="flex flex-col items-center gap-1 pb-1">
              <label htmlFor="tx-amount-input" className={labelClass}>Monto en pesos</label>
              <div className={`flex w-full min-w-0 items-baseline justify-center gap-1 ${type === 'expense' ? 'text-rose-300' : type === 'income' ? 'text-emerald-300' : 'text-kyo-lightPurple'}`}>
                <span aria-hidden="true" className="text-4xl font-light">$</span>
                <input id="tx-amount-input" aria-label="Monto en pesos chilenos" required type="text" inputMode="numeric" autoComplete="off" placeholder="0"
                  value={amount ? Number(amount).toLocaleString('es-CL') : ''}
                  onChange={event => setAmount(event.target.value.replace(/\D/g, ''))}
                  style={{ width: `${Math.max(1, (amount ? Number(amount).toLocaleString('es-CL') : '').length)}ch`, maxWidth: 'calc(100% - 2rem)' }}
                  className="min-w-0 border-0 bg-transparent py-1 text-center text-5xl font-light tracking-tight outline-none placeholder:text-on-surface-card-secondary/50 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-brand-primary/40" />
              </div>
            </div>

            <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-raised/40 p-1.5">
              {([
                { value: 'expense', label: 'Gasto', Icon: ArrowUpRight, active: 'border-rose-400/50 bg-rose-400/15 text-rose-300' },
                { value: 'income', label: 'Ingreso', Icon: ArrowDownLeft, active: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300' },
                { value: 'transfer', label: 'Transferir', Icon: ArrowRightLeft, active: 'border-violet-400/50 bg-brand-primary/25 text-violet-200' },
              ] as const).map(({ value, label, Icon, active }) => <button key={value} type="button" aria-pressed={type === value}
                onClick={() => { setType(value); setCategoryId(''); setDestinationAccountId(''); if (!selectTransactionAccounts(activeAccounts, value).some(account => account.id === accountId)) setAccountId(''); setInstallments('1'); setError(''); }}
                className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-kyo-lightPurple ${type === value ? active : 'border-transparent text-on-surface-card-secondary hover:bg-surface-raised hover:text-on-background'}`}><Icon size={18} />{label}</button>)}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tx-name-input" className={labelClass}>Descripción</label>
              <input id="tx-name-input" required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder={type === 'expense' ? '¿En qué gastaste?' : type === 'income' ? '¿De dónde viene este ingreso?' : 'Ej. Traspaso a mi cuenta de ahorro'} className={inputClass} />
            </div>

            <TransactionSelect label={type === 'transfer' ? 'Cuenta de origen' : type === 'income' ? 'Cuenta de ingreso' : 'Medio de pago'} value={accountId} options={instrumentOptions} disabled={isSaving}
              placeholder={type === 'expense' ? 'Selecciona cuenta o tarjeta' : 'Selecciona una cuenta'}
              onChange={id => { setAccountId(id); setInstallments('1'); if (id === destinationAccountId) setDestinationAccountId(''); }} />
            {instrumentOptions.length === 0 && <p role="status" className="text-xs text-on-surface-card-secondary">No tienes cuentas compatibles con este tipo de movimiento. Puedes cambiar el tipo o añadir una cuenta en Billetera.</p>}
            {type === 'transfer' && <>
              <TransactionSelect label="Cuenta de destino" value={destinationAccountId} options={accountOptions.filter(option => option.id !== accountId)} disabled={isSaving} placeholder="Selecciona otra cuenta" onChange={setDestinationAccountId} />
              {accounts.length < 2 && <p role="alert" className="text-xs text-on-surface-card-secondary">Necesitas dos cuentas activas para transferir.</p>}
            </>}
            {selectedCard && <div className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 p-3">
              <label htmlFor="tx-installments" className={labelClass}>Número de cuotas</label>
              <input id="tx-installments" type="number" required min="1" max="99" step="1" value={installments} onChange={event => setInstallments(event.target.value)} className={`${inputClass} mt-2`} />
              {Number(amount) > 0 && Number(installments) >= 1 && Number.isInteger(Number(installments)) && Number(installments) <= Number(amount) && <p className="mt-2 text-xs text-on-surface-card-body">{Number(installments) === 1 ? 'Una compra sin cuotas' : `${installments} cuotas · capital de $${Math.floor(Number(amount) / Number(installments)).toLocaleString('es-CL')} por cuota`}.{Number(amount) % Number(installments) !== 0 && ' La última cuota absorbe la diferencia.'}</p>}
              <p className="mt-1 text-xs text-on-surface-card-secondary">La compra utiliza cupo de crédito; no descuenta dinero de tus cuentas. Los cargos de la tarjeta se reflejan en su estado de cuenta.</p>
            </div>}
            <div className="flex flex-col gap-4">
              {type !== 'transfer' && <CategorySelect type={type} label="Categoría" value={categoryId} disabled={isSaving} placeholder="Selecciona categoría" onChange={setCategoryId}
                options={categories.map(category => { const Icon = (LucideIcons as unknown as Record<string, typeof Tag>)[category.icon_name || ''] || Tag; return { id: category.id, name: category.name, icon: <Icon size={17} style={{ color: '#a0a0b8' }} /> }; })} />}
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="tx-date-input" className={labelClass}>Fecha</label>
                <input id="tx-date-input" required type="date" value={date} onChange={event => setDate(event.target.value)} className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`} />
              </div>
            </div>

            {!selectedCard && <details className="rounded-xl border border-border-subtle bg-surface-card px-3.5 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-on-surface-card-secondary"><NotebookPen size={15} />Añadir una nota <span className="ml-auto text-[10px]">Opcional</span></summary>
              <label htmlFor="tx-note-input" className="sr-only">Nota (opcional)</label>
              <textarea id="tx-note-input" rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Agrega algún detalle que quieras recordar" className="mt-3 w-full resize-y bg-transparent text-sm text-on-background outline-none placeholder:text-on-surface-card-secondary/70 focus-visible:ring-2 focus-visible:ring-brand-primary/40" />
            </details>}

            {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">{error}</p>}

            <Button type="submit" isDisabled={isSaving} className="mt-1 w-full rounded-xl bg-brand-primary py-3 font-semibold text-white hover:bg-[#5b21b6]">{isSaving ? 'Guardando…' : selectedCard ? 'Guardar compra' : type === 'transfer' ? 'Guardar transferencia' : type === 'income' ? 'Guardar ingreso' : 'Guardar gasto'}</Button>
          </fieldset>
        </form>}
    </AppModal>
  );
}
