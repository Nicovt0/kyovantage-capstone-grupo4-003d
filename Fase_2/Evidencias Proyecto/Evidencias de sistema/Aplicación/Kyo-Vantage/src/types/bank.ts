export interface Bank {
  id: string;
  name: string;
  color: string;
  logo_url?: string | null;
  primary_color?: string | null;
  is_active?: boolean;
}

export type AccountTemplateType = 'checking' | 'sight' | 'savings' | 'cash' | 'investment';
export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'other';
export type TemplateCurrency = 'CLP' | 'UF';

export interface AccountTemplate {
  id: string;
  bank_id: string;
  name: string;
  type: AccountTemplateType;
  currency?: string | null;
  maintenance_cost?: number | null;
  maintenance_currency?: TemplateCurrency | null;
  bank?: Bank;
}

export interface CreditCardTemplate {
  id: string;
  bank_id: string;
  name: string;
  card_network: CardNetwork;
  default_maintenance_cost?: number | null;
  maintenance_currency?: TemplateCurrency | null;
  default_monthly_interest_rate?: number | null;
  default_penalty_interest_rate?: number | null;
  bank?: Bank;
}
