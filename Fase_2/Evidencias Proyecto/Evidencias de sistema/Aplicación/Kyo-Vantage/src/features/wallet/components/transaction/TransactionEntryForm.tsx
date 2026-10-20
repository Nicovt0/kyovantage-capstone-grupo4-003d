import { selectActiveAccounts } from '@/features/wallet/selectors/accountSelectors';
import { useAccountingAction } from '@/features/accounting/hooks/useAccountingAction';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Account, Category } from '@/types';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';
import { addTransaction } from '@/features/wallet/api/transactionRepository';

export function TransactionEntryForm({ accounts: allAccounts, categories: allCategories }: { accounts: Account[]; categories: Category[] }) {
  const navigate = useNavigate();
  const runAccounting = useAccountingAction();
  const { runMutation, isPending } = usePrivateMutation();
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [error, setError] = useState('');
  const accounts = selectActiveAccounts(allAccounts);
  const categories = allCategories.filter(category => category.type === type);
  const field = 'w-full rounded-xl border border-white/20 bg-white dark:bg-surface-card p-3 text-foreground';
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError('');
    const account = accounts.find(item => item.id === accountId);
    const numericAmount = Number(amount);
    if (!account || (type !== 'transfer' && !categories.some(item => item.id === categoryId)) || !name.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Completa la cuenta, categoría, descripción y un monto mayor a cero.'); return;
    }
    if (type !== 'income' && numericAmount > account.balance) {
      setError(`Saldo insuficiente: esta cuenta tiene $${account.balance.toLocaleString('es-CL')}.`); return;
    }
    if (type === 'transfer' && (!accounts.some(item => item.id === destinationAccountId) || destinationAccountId === accountId)) {
      setError('Selecciona una cuenta destino activa distinta de la cuenta de origen.');
      return;
    }
    const selectedDate = new Date(`${date}T12:00:00`);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate > today) {
      setError('Elige una fecha válida hasta hoy. Los pagos futuros se registran en Agenda.'); return;
    }
    try {
      const payload = { account_id: accountId, category_id: type === 'transfer' ? undefined : categoryId, destination_account_id: type === 'transfer' ? destinationAccountId : undefined, name: name.trim(), amount: numericAmount, type, date: selectedDate.toISOString(), status: 'paid', note: note.trim() || undefined } as const;
      await runMutation(() => runAccounting(payload, requestId => addTransaction(payload, false, requestId)));
      navigate('/wallet');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento.'); }
  }
  return <div className="space-y-4">
    <h1 className="text-2xl md:hidden">Añadir Transacción</h1>
    <p className="text-sm text-default-500">Registra un gasto, un ingreso o una transferencia entre tus cuentas. Para compromisos futuros, utiliza Agenda.</p>
    {accounts.length === 0 ? <p>Crea una cuenta en Billetera antes de registrar movimientos.</p> : <form onSubmit={save} className="space-y-4 pb-24">
      <label className="block">Tipo<select className={field} value={type} onChange={event => { setType(event.target.value as 'expense' | 'income' | 'transfer'); setCategoryId(''); setDestinationAccountId(''); }}><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="transfer">Transferencia entre mis cuentas</option></select></label>
      <label className="block">{type === 'transfer' ? 'Cuenta de origen' : 'Cuenta'}<select required className={field} value={accountId} onChange={event => { setAccountId(event.target.value); if (event.target.value === destinationAccountId) setDestinationAccountId(''); }}><option value="">Selecciona una cuenta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · ${account.balance.toLocaleString('es-CL')}</option>)}</select></label>
      {type === 'transfer' && <label className="block">Cuenta de destino<select required className={field} value={destinationAccountId} onChange={event => setDestinationAccountId(event.target.value)}><option value="">Selecciona otra cuenta</option>{accounts.filter(account => account.id !== accountId).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{accounts.length < 2 && <span>Necesitas dos cuentas activas para transferir.</span>}</label>}
      {type !== 'transfer' && (<label className="block">Categoría<select required className={field} value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Selecciona una categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>) }
      <label className="block">Descripción<input required maxLength={200} className={field} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="block">Monto ($ CLP)<input required type="number" min="1" step="1" className={field} value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <label className="block">Fecha<input required type="date" className={field} value={date} onChange={event => setDate(event.target.value)} /></label>
      <label className="block">Nota (opcional)<input maxLength={1000} className={field} value={note} onChange={event => setNote(event.target.value)} /></label>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button type="submit" disabled={isPending} className="w-full rounded-xl bg-brand-primary p-3 font-bold text-white disabled:opacity-50">{isPending ? 'Guardando…' : 'Guardar movimiento'}</button>
    </form>}
  </div>;
}
