
import { accountingMutation } from '@/features/accounting/api/accountingRepository';
import { Account, AccountInput, AccountTemplate } from "@/types";
import { accountsDb } from '@/mockdata/accounts';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";
import { createNotification } from "@/features/notifications/api/notificationRepository";
import {
  findAccountTemplate,
  getAccountTemplatesByIds,
  templateConfigurationError,
  toDatabaseAccountType,
  toDatabaseCurrency,
  toUiAccountType,
  toUiCurrency,
} from './bankTemplateRepository';

interface RawAccountRow {
  id: string;
  user_id?: string;
  template_id?: string | null;
  bank_id?: string | null;
  name: string;
  type?: string | null;
  balance?: number | null;
  current_balance?: number | null;
  include_in_total?: boolean | null;
  color?: string | null;
  last_digits?: string | null;
  is_salary_account?: boolean | null;
  currency?: string | null;
  maintenance_cost?: number | null;
  maintenance_currency?: string | null;
  is_archived?: boolean | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

const normalizeAccount = (row: RawAccountRow, template?: AccountTemplate): Account => {
  const effectiveBalance = row.balance ?? row.current_balance ?? 0;
  return {
    ...row,
    template_id: row.template_id ?? null,
    // Compatibility alias for the current UI. The staging DB only stores the
    // template relation, never this field.
    bank_id: template?.bank_id ?? row.bank_id ?? null,
    color: template?.bank?.color ?? row.color ?? '#534AB7',
    balance: effectiveBalance,
    current_balance: row.current_balance ?? effectiveBalance,
    include_in_total: row.include_in_total ?? true,
    is_salary_account: row.is_salary_account ?? false,
    type: toUiAccountType(row.type ?? undefined),
    currency: row.currency ?? template?.currency ?? 'CLP',
    last_digits: row.last_digits ?? undefined,
    maintenance_cost: row.maintenance_cost ?? template?.maintenance_cost ?? 0,
    is_archived: row.is_archived ?? (row.is_active !== undefined && row.is_active !== null ? !row.is_active : false),
    is_active: row.is_active ?? (row.is_archived !== undefined && row.is_archived !== null ? !row.is_archived : true),
    maintenance_currency: toUiCurrency(row.maintenance_currency ?? template?.maintenance_currency ?? undefined),
  };
};

const hydrateAccounts = async (rows: RawAccountRow[]): Promise<Account[]> => {
  const templateIds = rows
    .map(row => row.template_id)
    .filter((id): id is string => Boolean(id));

  let templates = new Map<string, AccountTemplate>();
  try {
    templates = await getAccountTemplatesByIds(templateIds);
  } catch (error) {
    // Account rows are still useful if a deployment has not exposed the
    // template relation yet; keep the list visible and report the mismatch.
    console.error('Error fetching account templates:', error);
  }

  return rows.map(row => normalizeAccount(row, templates.get(row.template_id || '')));
};

const resolveAccountTemplate = async (account: AccountInput) => {
  const bankId = account.bank_id && account.bank_id !== 'none' ? account.bank_id : null;
  const template = await findAccountTemplate({
    templateId: account.template_id,
    bankId,
    type: account.type,
  });

  if ((account.template_id || bankId) && !template) {
    throw templateConfigurationError('cuentas');
  }

  return template;
};

export const getAccounts = async (): Promise<Account[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...accountsDb]), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*');

  if (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }

  return hydrateAccounts(data || []);
};

export const getAccountById = async (id: string): Promise<Account | undefined> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(accountsDb.find(a => a.id === id)), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching account with id ${id}:`, error.message);
  }

  if (!data) return undefined;
  const [account] = await hydrateAccounts([data]);
  return account;
};

export const addAccount = async (account: AccountInput): Promise<Account> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newAccount: Account = {
          ...account,
          id: `acc-${Math.random().toString(36).substr(2, 9)}`,
          bank_id: account.bank_id ?? null,
          include_in_total: account.include_in_total ?? true,
        };
        accountsDb.push(newAccount as typeof accountsDb[number]);
        resolve(newAccount);
      }, 100);
    });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  // Verify unique name among active accounts
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', account.name)
    .neq('is_archived', true)
    .single();

  if (existing) {
    throw new Error('Ya existe una cuenta activa con este nombre.');
  }

  const template = await resolveAccountTemplate(account);

  // Adaptamos el payload antiguo al contrato real de staging. En particular,
  // bank_id, color, overdraft_limit e is_deletable no son columnas de accounts.
  const accountData = {
    template_id: template?.id ?? null,
    name: account.name,
    type: toDatabaseAccountType(account.type),
    balance: account.balance,
    currency: account.currency || template?.currency || 'CLP',
    last_digits: account.last_digits || null,
    include_in_total: account.include_in_total ?? true,
    is_salary_account: account.is_salary_account ?? false,
    maintenance_cost: account.maintenance_cost ?? template?.maintenance_cost ?? 0,
    maintenance_currency: toDatabaseCurrency(account.maintenance_currency || template?.maintenance_currency || undefined),
    is_archived: account.is_archived ?? (account.is_active !== undefined ? !account.is_active : false),
    is_active: account.is_active ?? (account.is_archived !== undefined ? !account.is_archived : true),
  };

  const data = await accountingMutation<RawAccountRow>('create_account', accountData);

  try {
    await createNotification({
      type: 'creation',
      title: 'Cuenta Creada',
      message: `Has creado exitosamente la cuenta "${account.name}".`
    });
  } catch (error) { console.error('Cuenta creada; no se pudo crear su notificación.', error); }

  return normalizeAccount(data, template || undefined);
};

export const ensureCashAccount = async (): Promise<void> => {
  // Ahora manejado por un trigger en Supabase
};
export const toggleCashAccount = async (enabled: boolean): Promise<void> => {
  if (USE_MOCKS) return;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('accounts')
    .update({ include_in_total: enabled })
    .eq('user_id', user.id)
    .eq('type', 'cash');
};

export const updateAccount = async (id: string, updates: Partial<Account>): Promise<Account> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = accountsDb.findIndex(a => a.id === id);
        if (idx === -1) return reject(new Error('Account not found'));
        accountsDb[idx] = { ...accountsDb[idx], ...updates };
        resolve(accountsDb[idx]);
      }, 100);
    });
  }

  const supabase = createClient();

  // Verify unique name if name is updated
  if (updates.name) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', updates.name)
        .neq('is_archived', true)
        .neq('id', id)
        .single();

      if (existing) {
        throw new Error('Ya existe una cuenta activa con este nombre.');
      }
    }
  }

  const dbUpdates: Record<string, unknown> = {};
  const source = updates as Record<string, unknown>;
  const supportedFields = [
    'name', 'balance', 'include_in_total', 'is_salary_account',
    'currency', 'maintenance_cost', 'is_archived', 'is_active', 'last_digits',
  ];

  for (const field of supportedFields) {
    if (field in source) dbUpdates[field] = source[field];
  }

  // Synchronize is_active and is_archived in updates
  if ('is_active' in source && !('is_archived' in source)) {
    dbUpdates.is_archived = !source.is_active;
  } else if ('is_archived' in source && !('is_active' in source)) {
    dbUpdates.is_active = !source.is_archived;
  }

  if ('type' in source) {
    dbUpdates.type = toDatabaseAccountType(typeof source.type === 'string' ? source.type : undefined);
  }

  if ('maintenance_currency' in source) {
    dbUpdates.maintenance_currency = toDatabaseCurrency(
      typeof source.maintenance_currency === 'string' ? source.maintenance_currency : undefined,
    );
  }

  if ('template_id' in source || 'bank_id' in source) {
    if ('template_id' in source) {
      const template = await findAccountTemplate({
        templateId: typeof source.template_id === 'string' ? source.template_id : null,
      });
      if (source.template_id && !template) throw templateConfigurationError('cuentas');
      dbUpdates.template_id = template?.id ?? null;
    } else if (!source.bank_id || source.bank_id === 'none') {
      dbUpdates.template_id = null;
    } else {
      const current = await supabase.from('accounts').select('type').eq('id', id).single();
      const template = await findAccountTemplate({
        bankId: String(source.bank_id),
        type: typeof source.type === 'string' ? source.type : current.data?.type,
      });
      if (!template) throw templateConfigurationError('cuentas');
      dbUpdates.template_id = template.id;
    }
  }

  if (Object.keys(dbUpdates).length === 0) {
    throw new Error('No hay cambios compatibles con el esquema de staging.');
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (updates.name) {
    await createNotification({
      type: 'system',
      title: 'Cuenta Actualizada',
      message: `Has modificado la cuenta "${updates.name}".`
    });
  }

  const [account] = await hydrateAccounts([data]);
  return account;
};

export const deleteAccount = async (id: string, deleteTransactions: boolean = false): Promise<void> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = accountsDb.findIndex(a => a.id === id);
        if (idx === -1) return reject(new Error('Account not found'));
        Object.assign(accountsDb[idx], { is_archived: true, is_active: false, include_in_total: false });
        resolve();
      }, 100);
    });
  }

  if (deleteTransactions) throw new Error('El historial contable se conserva. Archiva la cuenta sin eliminar movimientos.');
  await accountingMutation('archive_account', { id });

  await createNotification({
    type: 'system',
    title: 'Cuenta Archivada',
    message: `Has archivado una cuenta conservando su historial.`
  });
};
