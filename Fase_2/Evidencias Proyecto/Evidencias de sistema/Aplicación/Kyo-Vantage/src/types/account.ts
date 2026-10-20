export interface Account {
  id: string;
  user_id?: string;
  name: string;
  /**
   * Canonical staging relation. `bank_id` is kept as a derived compatibility
   * field for existing presentation components and mocks; it is never written
   * to `public.accounts`.
   */
  template_id?: string | null;
  bank_id?: string | null;
  balance: number;
  current_balance?: number;
  include_in_total: boolean;
  color?: string;
  type?: string;
  last_digits?: string;
  is_salary_account?: boolean;
  is_deletable?: boolean;
  currency?: string;
  overdraft_limit?: number;
  is_archived?: boolean;
  is_active?: boolean;
  maintenance_cost?: number;
  maintenance_currency?: 'clp' | 'uf' | 'CLP' | 'UF';
}

export interface AccountInput {
  name: string;
  template_id?: string | null;
  /** Legacy UI field. It is resolved to `template_id` before writing. */
  bank_id?: string | null;
  balance: number;
  current_balance?: number;
  include_in_total?: boolean;
  type?: string;
  last_digits?: string;
  is_salary_account?: boolean;
  is_archived?: boolean;
  is_active?: boolean;
  currency?: string;
  maintenance_cost?: number;
  maintenance_currency?: 'clp' | 'uf' | 'CLP' | 'UF';
  /** Local-only value used to create the initial transaction. */
  initial_balance?: number;
  /** Legacy UI-only fields; ignored by the staging adapter. */
  color?: string;
  overdraft_limit?: number;
  is_deletable?: boolean;
}
