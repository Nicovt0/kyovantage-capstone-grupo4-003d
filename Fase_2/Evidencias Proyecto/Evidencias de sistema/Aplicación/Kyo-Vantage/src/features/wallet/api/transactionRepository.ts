import { Goal, Transaction, Account, CreditCard } from "@/types";
import { transactionsDb } from '@/mockdata/transactions';
import { accountsDb } from '@/mockdata/accounts';
import { checkBudgetLimits } from '@/features/budget/api/budgetRepository';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";
import { createNotification } from "@/features/notifications/api/notificationRepository";
import { accountingMutation } from '@/features/accounting/api/accountingRepository';
import { goalsDb } from '@/mockdata/goals';
import { creditCardsDb } from '@/mockdata/creditCards';

async function assertEditableTransaction(id: string): Promise<void> {
  if (USE_MOCKS) return;
  const { data, error } = await createClient().from('agenda_occurrence_payments')
    .select('transaction_id').eq('transaction_id', id).maybeSingle();
  // Older environments may not have deployed the Agenda migration yet.
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return;
  if (error) throw error;
  if (data) throw new Error('Este movimiento corresponde a un pago de Agenda confirmado. No se puede editar, reabrir ni eliminar sin una reversión contable.');
}

async function hydrateAgendaPaymentStatus(transactions: Transaction[]): Promise<Transaction[]> {
  const ids = transactions.map(transaction => transaction.id);
  if (!ids.length) return transactions;
  const confirmed = new Set<string>();
  const billing = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch=ids.slice(offset,offset+200).join(',');
    const {data,error}=await createClient().from('agenda_occurrence_payments')
      .select('transaction_id,destination_transaction_id,receipt_type')
      .or(`transaction_id.in.(${batch}),destination_transaction_id.in.(${batch})`);
    if(error) throw new Error(['42703','PGRST204'].includes(error.code)
      ? 'Staging necesita la migración 20261018000004_restore_original_tables.sql.' : error.message);
    for(const payment of data ?? []) {
      if(payment.receipt_type==='billing') billing.add(payment.transaction_id);
      else if(payment.transaction_id) confirmed.add(payment.transaction_id);
      if(payment.destination_transaction_id) confirmed.add(payment.destination_transaction_id);
    }
  }
  return transactions.map(transaction => ({ ...transaction, ...(billing.has(transaction.id) ? { billing_payment: true } : {}) })).map(transaction => confirmed.has(transaction.id)
    ? { ...transaction, status: 'paid' as const, agenda_payment: true } : { ...transaction, status: transaction.status ?? 'paid' as const });
}

export const getTransactions = async (): Promise<Transaction[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...transactionsDb]), 50);
    });
  }

  const supabase = createClient();
  const rows:Transaction[]=[];
  const pageSize=500;
  for(;;) {
    const {data,error,count}=await supabase.from('transactions').select('*',{count:'exact'})
      .order('date',{ascending:false}).order('id',{ascending:false}).range(rows.length,rows.length+pageSize-1);
    if(error) throw new Error(`No se pudieron cargar los movimientos. ${error.message || ''}`);
    const page=(data ?? []) as Transaction[];
    rows.push(...page);
    if(count!==null && count!==undefined && rows.length>=count)break;
    if(!page.length) {
      if(count && rows.length<count)throw new Error('El historial quedó incompleto. Intenta nuevamente.');
      break;
    }
    if(count==null && page.length<pageSize)break;
  }
  return hydrateAgendaPaymentStatus(rows);
};

export const getTransactionsByAccount = async (account_id: string): Promise<Transaction[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(transactionsDb.filter(t => t.account_id === account_id)), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', account_id)
    .order('date', { ascending: false });
  if (error) return [];
  return hydrateAgendaPaymentStatus((data ?? []) as Transaction[]);
};

export const getTransactionsByCreditCard = async (credit_card_id: string): Promise<Transaction[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(transactionsDb.filter(t => t.credit_card_id === credit_card_id)), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('credit_card_id', credit_card_id)
    .order('date', { ascending: false });
  if (error) return [];
  return hydrateAgendaPaymentStatus((data ?? []) as Transaction[]);
};

function validateAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('El importe debe ser positivo y finito.');
}

/** Mocks apply net effects before changing any row, mirroring the server's rollback behavior. */
function applyMockChange(previous: Transaction[], next: Transaction[]) {
  const accounts = new Map<string, number>();
  const goals = new Map<string, number>();
  const cards = new Map<string, number>();
  const add = (map: Map<string, number>, id: string | undefined, amount: number) => {
    if (id) map.set(id, (map.get(id) || 0) + amount);
  };
  for (const [rows, sign] of [[previous, -1], [next, 1]] as const) {
    for (const tx of rows) {
      validateAmount(tx.amount);
      if (tx.status && tx.status !== 'paid') continue;
      if (tx.type === 'transfer') {
        add(accounts, tx.source_account_id || tx.account_id, -sign * tx.amount);
        add(accounts, tx.destination_account_id, sign * tx.amount);
      } else if (tx.account_id) {
        add(accounts, tx.account_id, sign * tx.amount * (tx.type === 'income' ? 1 : -1));
      } else if (tx.credit_card_id) {
        add(cards, tx.credit_card_id, sign * tx.amount * (tx.type === 'income' ? -1 : 1));
      }
      if (tx.type !== 'income') add(goals, tx.goal_id, sign * tx.amount);
    }
  }
  for (const [id, delta] of accounts) {
    const account = accountsDb.find(row => row.id === id) as Account | undefined;
    if (!account || account.is_archived || account.balance + delta < 0) throw new Error('Cuenta inválida o saldo insuficiente.');
  }
  for (const [id, delta] of goals) {
    const goal = goalsDb.find(row => row.id === id);
    if (!goal || goal.current_amount + delta < 0) throw new Error('La meta no permite esta operación.');
  }
  for (const [id, delta] of cards) {
    const card = creditCardsDb.find(row => row.id === id) as CreditCard | undefined;
    if (!card || card.is_archived || (card.current_debt || 0) + delta < 0) throw new Error('La tarjeta no permite esta operación.');
  }
  for (const [id, delta] of accounts) {
    const account = accountsDb.find(row => row.id === id)!;
    account.balance += delta;
    account.current_balance = account.balance;
  }
  for (const [id, delta] of goals) {
    const goal = goalsDb.find(row => row.id === id);
    if (goal) goal.current_amount += delta;
  }
  for (const [id, delta] of cards) {
    const card = creditCardsDb.find(row => row.id === id) as CreditCard | undefined;
    if (card) card.current_debt = (card.current_debt || 0) + delta;
  }
}

function pairedRows(id: string): Transaction[] {
  const row = transactionsDb.find(tx => tx.id === id) as Transaction | undefined;
  if (!row) throw new Error('Movimiento no encontrado.');
  if (row.agenda_payment) throw new Error('Pago confirmado protegido: requiere una reversión contable.');
  return (transactionsDb as Transaction[]).filter(tx => tx.id === id || (row.transfer_group_id && tx.transfer_group_id === row.transfer_group_id));
}

export const addTransaction = async (transaction: Omit<Transaction, 'id' | 'category_id'> & { category_id?: string }, suppressNotification = false, requestId?: string): Promise<Transaction> => {
  validateAmount(transaction.amount);
  if (USE_MOCKS) {
    const row = { ...transaction, id: `tx-${Math.random().toString(36).slice(2)}` } as Transaction;
    if (row.destination_account_id) {
      row.type = 'transfer';
      if (row.account_id === row.destination_account_id) throw new Error('Selecciona dos cuentas distintas.');
    }
    applyMockChange([], [row]);
    transactionsDb.push(row);
    return row;
  }
  if (transaction.status === 'pending') throw new Error('Registra los pagos futuros como compromisos en Agenda.');
  const { agenda_payment: _agenda, billing_payment: _billing, has_interest: _interest, validated_at: _validated, ...payload } = transaction;
  const saved = await accountingMutation<Transaction>('create_transaction', payload, requestId);
  // Notifications are secondary: failure after commit must not invite a duplicate financial retry.
  try {
    if (!suppressNotification) await createNotification({ type: 'transaction', title: 'Movimiento Registrado', message: `Se ha registrado un movimiento por $${transaction.amount.toLocaleString('es-CL')}.` });
    if (transaction.type === 'expense' && transaction.category_id) await checkBudgetLimits(transaction.category_id, transaction.amount);
  } catch (error) { console.error('Movimiento confirmado; no se pudo actualizar su notificación.', error); }
  return saved;
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<void> => {
  await assertEditableTransaction(id);
  if (!USE_MOCKS) {
    await accountingMutation('update_transaction', { id, updates });
    return;
  }
  const previous = pairedRows(id);
  const next = previous.map(row => row.id === id ? { ...row, ...updates } : {
    ...row, amount: updates.amount ?? row.amount, date: updates.date ?? row.date,
    status: updates.status ?? row.status, account_id: updates.destination_account_id ?? row.account_id,
  });
  applyMockChange(previous, next);
  for (const row of next) Object.assign(transactionsDb.find(tx => tx.id === row.id)!, row);
};

export const updateTransactionStatus = async (id: string, status: 'paid' | 'pending', updates?: Partial<Transaction>): Promise<void> => {
  await updateTransaction(id, { ...updates, status });
};

export const deleteTransaction = async (id: string, revertBalance = true): Promise<void> => {
  await assertEditableTransaction(id);
  if (!USE_MOCKS) {
    await accountingMutation('delete_transaction', { id, revert_balance: revertBalance });
    return;
  }
  const previous = pairedRows(id);
  if (!revertBalance && previous.some(row => !row.status || row.status === 'paid')) throw new Error('Eliminar un movimiento pagado exige revertir su efecto contable.');
  applyMockChange(previous, []);
  const ids = new Set(previous.map(row => row.id));
  for (let i = transactionsDb.length - 1; i >= 0; i--) if (ids.has(transactionsDb[i].id)) transactionsDb.splice(i, 1);
};

type ConfirmPendingTransactionInput = {
  transaction: Transaction;
  name: string;
  amount: number;
  accountId: string;
  date: string;
  savingsAccountId?: string;
  requestId?: string;
};

export const confirmPendingTransaction = async ({ transaction, name, amount, accountId, date, savingsAccountId, requestId }: ConfirmPendingTransactionInput): Promise<void> => {
  await assertEditableTransaction(transaction.id);
  validateAmount(amount);
  const updates = { name, amount, account_id: accountId, date };
  if (!USE_MOCKS) {
    await accountingMutation('confirm_pending', { id: transaction.id, updates, savings_account_id: savingsAccountId }, requestId);
    return;
  }
  const previous = pairedRows(transaction.id);
  if (previous[0].status === 'paid') return;
  const next: Transaction[] = [{ ...previous[0], ...updates, status: 'paid' }];
  if (savingsAccountId && transaction.goal_id) {
    if (accountId === savingsAccountId) throw new Error('El ahorro requiere otra cuenta destino.');
    next[0].type = 'transfer'; next[0].destination_account_id = savingsAccountId;
  }
  applyMockChange(previous, next);
  Object.assign(transactionsDb.find(tx => tx.id === transaction.id)!, next[0]);
};

export const skipPendingTransaction = async (transaction: Transaction, goal?: Goal): Promise<void> => {
  if (transaction.status !== 'pending') throw new Error('Solo se pueden omitir movimientos pendientes.');
  // The server deletes only a pending row and adjusts the goal plan in the same transaction.
  if (!USE_MOCKS) {
    await accountingMutation('skip_pending', { id: transaction.id, goal_id: goal?.id });
    return;
  }
  await deleteTransaction(transaction.id, false);
};
