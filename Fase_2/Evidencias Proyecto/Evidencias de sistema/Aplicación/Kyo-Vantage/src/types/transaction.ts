export interface Transaction {
  id: string;
  user_id?: string;
  account_id?: string; // Puede pertenecer a una Cuenta (Billetera)
  credit_card_id?: string; // O puede pertenecer a una Tarjeta de Crédito
  goal_id?: string; // O puede ser un aporte a una Meta
  category_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  date: string;
  // Específico para compras en cuotas o tarjetas
  name?: string; // Ej: "Scooter Eléctrico" (Para saber qué se compró)
  installment_current?: number; // Cuota actual (Ej: 3)
  installment_total?: number;   // Total de cuotas (Ej: 9)
  has_interest?: boolean;       // Indica si aplica interés rotativo/amortización francesa
  status?: 'paid' | 'pending' | 'cancelled';
  billing_payment?: boolean; // Confirmed card-payment receipt; requires a dedicated reversal.
  agenda_payment?: boolean; // Client projection of a confirmed Agenda payment.
  due_date?: string;
  validated_at?: string | null;
  is_recurring?: boolean;
  source_account_id?: string; // Para transferencias internas
  destination_account_id?: string; // Para transferencias internas
  transfer_group_id?: string; // Identificador único para vincular el egreso y el ingreso de una transferencia
  origin_transaction_id?: string; // ID original del gasto en una transferencia agrupada
  destination_transaction_id?: string; // ID original del ingreso en una transferencia agrupada
  note?: string;
}
