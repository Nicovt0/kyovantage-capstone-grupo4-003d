export interface Transaction {
  id: string;
  user_id?: string;
  account_id?: string; // Puede pertenecer a una Cuenta (Billetera)
  credit_card_id?: string; // O puede pertenecer a una Tarjeta de Crédito
  goal_id?: string;
  transfer_group_id?: string;
  agenda_payment?: boolean; // O puede ser un aporte a una Meta
  category_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  // Específico para compras en cuotas o tarjetas
  name?: string; // Ej: "Scooter Eléctrico" (Para saber qué se compró)
  installment_current?: number; // Cuota actual (Ej: 3)
  installment_total?: number;   // Total de cuotas (Ej: 9)
  status?: 'paid' | 'pending' | 'cancelled';
  due_date?: string;
  validated_at?: string | null;
  is_recurring?: boolean;
}

export const transactionsDb: Transaction[] = [
  // 1. Gasto normal en efectivo/débito
  {
    id: 't1',
    account_id: 'a2', // Afecta al saldo de la cuenta "Cuenta Corriente"
    category_id: 'exp-2', // Supermercado y Feria
    type: 'expense',
    amount: 45000,
    date: new Date().toISOString(),
    name: 'Jumbo Compra Semanal'
  },
  // 2. Ingreso normal
  {
    id: 't2',
    account_id: 'a2', // Entró a la "Cuenta Corriente"
    category_id: 'inc-1', // Sueldo
    type: 'income',
    amount: 1500000,
    date: new Date().toISOString(),
    name: 'Sueldo Mayo Empresa'
  },
  // 3. NUEVO: Compra en cuotas con Tarjeta de Crédito
  {
    id: 't3',
    credit_card_id: 'cc1', // Afecta al cupo de una tarjeta, NO a la liquidez de una cuenta
    category_id: 'exp-12', // Compras y Gustitos
    type: 'expense',
    amount: 59000, // Monto de UNA cuota
    date: new Date().toISOString(),
    name: 'Scooter Eléctrico Xiaomi',
    installment_current: 3, // Pagando la cuota 3
    installment_total: 9    // De un total de 9 cuotas
  },
  {
    id: 't-g1-1',
    goal_id: 'g1',
    category_id: 'exp-14',
    type: 'expense',
    amount: 50000,
    date: '2026-05-01T10:00:00.000Z',
    name: 'Aporte Mayo - Fondo Emergencia'
  },
  {
    id: 't-g1-2',
    goal_id: 'g1',
    category_id: 'exp-14',
    type: 'expense',
    amount: 50000,
    date: '2026-04-01T10:00:00.000Z',
    name: 'Aporte Abril - Fondo Emergencia'
  },
  {
    id: 't-g2-1',
    goal_id: 'g2',
    category_id: 'exp-14',
    type: 'expense',
    amount: 30000,
    date: '2026-05-02T10:00:00.000Z',
    name: 'Aporte Mayo - Japón'
  }
];


export const getTransactions = () => transactionsDb;
export const getTransactionsByAccount = (accountId: string) => 
  transactionsDb.filter(t => t.account_id === accountId);

export const addTransaction = (transaction: Transaction) => {
  transactionsDb.push(transaction);
  return transaction;
};
