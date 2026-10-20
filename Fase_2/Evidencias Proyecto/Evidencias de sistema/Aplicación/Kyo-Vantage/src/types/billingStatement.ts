export interface BillingStatement {
  id: string;
  user_id?: string;
  credit_card_id: string;

  // Período
  billing_period: string;        // Ej: "2026-05"
  billing_date: string;          // Fecha exacta del corte (ISO)
  payment_due_date: string;      // Fecha límite de pago (ISO)

  // Desglose de la fórmula
  consumed_amount: number;       // Compras sin cuotas
  installment_amount: number;    // Suma de cuotas del mes
  maintenance_cost: number;      // Costo de mantención (en CLP, ya convertido)
  // Derived fields kept for the UI. The current staging table does not store
  // these columns, so repositories default them to zero.
  refinanced_balance: number;
  interest_amount: number;

  // Totales
  total_due: number;             // Pago Total Pendiente
  minimum_payment: number;       // Pago Mínimo

  // UF (trazabilidad)
  maintenance_in_uf: boolean;
  uf_value_used?: number;        // Valor de UF al momento del corte

  // Estado de pago
  amount_paid: number;           // Cuánto ha abonado el usuario
  status: 'pending' | 'partial' | 'paid';

  // Datos para ML / Kyo Score
  actual_payment_date?: string;  // Fecha real del pago
  days_late?: number;            // Días de desfase (negativo = pagó antes)

  created_at?: string;
}
