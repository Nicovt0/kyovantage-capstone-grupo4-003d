import { Account } from './account';
import { CreditCard } from './creditCard';
import { Category } from './category';

export type RecurringFrequency = 'once' | 'monthly' | 'yearly';
export type RecurringStatus = 'pending' | 'paid' | 'overdue';
export type RecurringType = 'income' | 'expense';

export interface RecurringTemplate {
  id: string;
  goal_id?: string;
  contribution_type?: 'auto' | 'fixed' | 'free';
  user_id?: string;

  // Normalized primary fields
  title: string;
  amount: number;
  frequency: RecurringFrequency;
  status: RecurringStatus;

  // Compatibility aliases for existing UI and legacy repositories
  name: string;
  expected_amount: number;
  day_of_month?: number | null;

  // Relational references (optional normalized foreign keys)
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id?: string | null;

  // Scheduling and operational fields
  type: RecurringType;
  due_date?: string | null;
  next_due_date?: string | null;
  payment_day?: number | null;
  lead_days?: number;
  is_essential?: boolean;
  is_active?: boolean;
  last_generated_month?: string | null;
  created_at?: string;
  updated_at?: string;
  payment_transaction_id?: string;

  // Hydrated relational entities
  account?: Account | null;
  credit_card?: CreditCard | null;
  category?: Category | null;
}

export interface CreateRecurringTemplateDTO {
  user_id?: string;
  title: string;
  amount: number;
  frequency: RecurringFrequency;
  status?: RecurringStatus;
  due_date?: string | Date | null;
  next_due_date?: string | Date | null;
  payment_day?: number | null;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id?: string | null;
  type?: RecurringType;
  lead_days?: number;
  is_essential?: boolean;
  is_active?: boolean;

  // Compatibility aliases
  name?: string;
  expected_amount?: number;
  day_of_month?: number | null;
}

export interface UpdateRecurringTemplateDTO extends Partial<CreateRecurringTemplateDTO> {
  id?: string;
}
