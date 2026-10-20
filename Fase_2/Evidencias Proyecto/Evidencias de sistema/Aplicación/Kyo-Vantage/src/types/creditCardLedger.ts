export interface CreditCardLedger {
  id: string;
  user_id?: string;
  credit_card_id: string;
  category_id?: string;
  name: string;
  amount_total: number;
  remaining_principal?: number;
  installment_total: number;
  installment_current: number;
  amount_per_installment: number;
  purchase_date: string;
  status: 'active' | 'paid' | 'refinanced';
}
