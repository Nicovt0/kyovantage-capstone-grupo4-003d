export interface CreditCard {
  id: string;
  user_id?: string;
  name: string;
  /** Canonical staging relation. `bank_id` is derived for existing UI code. */
  template_id?: string | null;
  bank_id?: string;
  card_network?: 'visa' | 'mastercard' | 'amex' | 'other';
  total_limit: number;
  recommended_threshold: number; // Porcentaje recomendado para no exceder (ej: 30)
  billing_date: number; // Día del mes para la fecha de corte (ej: 15)
  payment_date: number; // Día del mes para la fecha de pago (ej: 5)
  maintenance_cost: number;
  maintenance_currency?: 'clp' | 'uf' | 'CLP' | 'UF'; // Unidad del costo de mantención
  monthly_interest_rate: number; // Porcentaje de interés (ej: 2.5)
  default_interest_rate?: number; // Tasa por mora mensual (default 2.9%)
  penalty_interest_rate?: number;
  type: string; // Ej: "Gold", "Signature", "Black"
  issuer: 'visa' | 'mastercard' | 'amex' | 'other';
  last_4_digits?: number | string;
  current_debt?: number;
  currency?: string;
  is_archived?: boolean;
}

export interface CreditCardInput {
  name: string;
  template_id?: string | null;
  /** Legacy UI field. It is resolved to `template_id` before writing. */
  bank_id?: string;
  total_limit: number;
  recommended_threshold?: number;
  billing_date: number;
  payment_date: number;
  maintenance_cost?: number;
  maintenance_currency?: 'clp' | 'uf' | 'CLP' | 'UF';
  monthly_interest_rate?: number;
  default_interest_rate?: number;
  penalty_interest_rate?: number;
  type: string;
  issuer: 'visa' | 'mastercard' | 'amex' | 'other';
  last_4_digits?: number | string;
  current_debt?: number;
  currency?: string;
  is_archived?: boolean;
}
