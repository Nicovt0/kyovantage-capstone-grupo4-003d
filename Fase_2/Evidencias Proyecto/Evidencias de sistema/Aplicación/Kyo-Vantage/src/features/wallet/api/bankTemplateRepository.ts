import { AccountTemplate, Bank, CreditCardTemplate } from '@/types';
import { createClient } from '@/utils/supabase/client';

const DEFAULT_BANK_COLOR = '#534AB7';

interface RawBankRow {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  color?: string | null;
  is_active?: boolean | null;
}

interface RawAccountTemplateRow {
  id: string;
  bank_id: string;
  name: string;
  type: AccountTemplate['type'];
  currency?: string | null;
  maintenance_cost?: number | null;
  maintenance_currency?: string | null;
}

interface RawCreditCardTemplateRow {
  id: string;
  bank_id: string;
  name: string;
  card_network: CreditCardTemplate['card_network'];
  default_maintenance_cost?: number | null;
  maintenance_currency?: string | null;
  default_monthly_interest_rate?: number | null;
  default_penalty_interest_rate?: number | null;
}

export const mapBankRow = (row: RawBankRow): Bank => ({
  id: row.id,
  name: row.name,
  color: row.primary_color || row.color || DEFAULT_BANK_COLOR,
  logo_url: row.logo_url ?? null,
  primary_color: row.primary_color ?? row.color ?? null,
  is_active: row.is_active ?? true,
});

const mapCurrency = (value: unknown): 'CLP' | 'UF' | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  return normalized === 'UF' ? 'UF' : normalized === 'CLP' ? 'CLP' : null;
};

const loadBanksByIds = async (ids: string[]): Promise<Map<string, Bank>> => {
  const result = new Map<string, Bank>();
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('banks')
    .select('id, name, logo_url, primary_color, is_active')
    .in('id', ids);

  if (error) throw error;
  for (const row of data || []) result.set(row.id, mapBankRow(row));
  return result;
};

const withBanks = async <T extends { bank_id: string }>(rows: T[]): Promise<(T & { bank?: Bank })[]> => {
  const banks = await loadBanksByIds([...new Set(rows.map(row => row.bank_id))]);
  return rows.map(row => ({ ...row, bank: banks.get(row.bank_id) }));
};

export const getAccountTemplates = async (): Promise<AccountTemplate[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_account_templates')
    .select('id, bank_id, name, type, currency, maintenance_cost, maintenance_currency')
    .order('name');

  if (error) throw error;
  const rows = ((data || []) as RawAccountTemplateRow[]).map(row => ({
    ...row,
    currency: row.currency ?? null,
    maintenance_currency: mapCurrency(row.maintenance_currency),
  })) as AccountTemplate[];
  return withBanks(rows);
};

export const getCreditCardTemplates = async (): Promise<CreditCardTemplate[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_credit_card_templates')
    .select('id, bank_id, name, card_network, default_maintenance_cost, maintenance_currency, default_monthly_interest_rate, default_penalty_interest_rate')
    .order('name');

  if (error) throw error;
  const rows = ((data || []) as RawCreditCardTemplateRow[]).map(row => ({
    ...row,
    maintenance_currency: mapCurrency(row.maintenance_currency),
  })) as CreditCardTemplate[];
  return withBanks(rows);
};

export const getAccountTemplatesByIds = async (ids: string[]): Promise<Map<string, AccountTemplate>> => {
  const result = new Map<string, AccountTemplate>();
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_account_templates')
    .select('id, bank_id, name, type, currency, maintenance_cost, maintenance_currency')
    .in('id', ids);
  if (error) throw error;

  const rows = ((data || []) as RawAccountTemplateRow[]).map(row => ({
    ...row,
    currency: row.currency ?? null,
    maintenance_currency: mapCurrency(row.maintenance_currency),
  })) as AccountTemplate[];
  for (const row of await withBanks(rows)) result.set(row.id, row);
  return result;
};

export const getCreditCardTemplatesByIds = async (ids: string[]): Promise<Map<string, CreditCardTemplate>> => {
  const result = new Map<string, CreditCardTemplate>();
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('bank_credit_card_templates')
    .select('id, bank_id, name, card_network, default_maintenance_cost, maintenance_currency, default_monthly_interest_rate, default_penalty_interest_rate')
    .in('id', ids);
  if (error) throw error;

  const rows = ((data || []) as RawCreditCardTemplateRow[]).map(row => ({
    ...row,
    maintenance_currency: mapCurrency(row.maintenance_currency),
  })) as CreditCardTemplate[];
  for (const row of await withBanks(rows)) result.set(row.id, row);
  return result;
};

export const findAccountTemplate = async (params: {
  templateId?: string | null;
  bankId?: string | null;
  type?: string;
}): Promise<AccountTemplate | null> => {
  if (!params.templateId && !params.bankId) return null;

  const supabase = createClient();
  let query = supabase
    .from('bank_account_templates')
    .select('id, bank_id, name, type, currency, maintenance_cost, maintenance_currency')
    .limit(1);

  if (params.templateId) query = query.eq('id', params.templateId);
  else query = query.eq('bank_id', params.bankId).eq('type', toDatabaseAccountType(params.type));

  const { data, error } = await query;
  if (error) throw error;
  const row = data?.[0] as RawAccountTemplateRow | undefined;
  if (!row) return null;
  const [template] = await withBanks([{
    ...row,
    currency: row.currency ?? null,
    maintenance_currency: mapCurrency(row.maintenance_currency),
  } as AccountTemplate]);
  return template || null;
};

export const findCreditCardTemplate = async (params: {
  templateId?: string | null;
  bankId?: string;
  name?: string;
  cardNetwork?: string;
}): Promise<CreditCardTemplate | null> => {
  if (!params.templateId && !params.bankId) return null;

  const supabase = createClient();
  let query = supabase
    .from('bank_credit_card_templates')
    .select('id, bank_id, name, card_network, default_maintenance_cost, maintenance_currency, default_monthly_interest_rate, default_penalty_interest_rate')
    .limit(1);

  if (params.templateId) query = query.eq('id', params.templateId);
  else {
    query = query.eq('bank_id', params.bankId);
    if (params.name) query = query.eq('name', params.name);
    if (params.cardNetwork) query = query.eq('card_network', params.cardNetwork);
  }

  const { data, error } = await query;
  if (error) throw error;
  const row = data?.[0] as RawCreditCardTemplateRow | undefined;
  if (!row) return null;
  const [template] = await withBanks([{
    ...row,
    maintenance_currency: mapCurrency(row.maintenance_currency),
  } as CreditCardTemplate]);
  return template || null;
};

export const toDatabaseAccountType = (type?: string): AccountTemplate['type'] => {
  switch (type?.toLowerCase()) {
    case 'corriente': return 'checking';
    case 'vista': return 'sight';
    case 'ahorro': return 'savings';
    case 'efectivo':
    case 'cash': return 'cash';
    case 'inversion':
    case 'investment': return 'investment';
    default: return (type || 'checking') as AccountTemplate['type'];
  }
};

export const toUiAccountType = (type?: string): string => {
  switch (type?.toLowerCase()) {
    case 'checking': return 'corriente';
    case 'sight': return 'vista';
    case 'savings': return 'ahorro';
    case 'cash': return 'efectivo';
    case 'investment': return 'inversion';
    default: return type || 'corriente';
  }
};

export const toDatabaseCurrency = (currency?: string): 'CLP' | 'UF' =>
  currency?.toUpperCase() === 'UF' ? 'UF' : 'CLP';

export const toUiCurrency = (currency?: string): 'clp' | 'uf' =>
  currency?.toUpperCase() === 'UF' ? 'uf' : 'clp';

export const templateConfigurationError = (entity: 'cuentas' | 'tarjetas') =>
  new Error(`Staging no tiene plantillas de ${entity} configuradas. Deben cargarse en bank_${entity === 'cuentas' ? 'account' : 'credit_card'}_templates antes de crear registros.`);
