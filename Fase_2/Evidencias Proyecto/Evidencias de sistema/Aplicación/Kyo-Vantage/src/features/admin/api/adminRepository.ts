import { Bank, AccountTemplate, CreditCardTemplate } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { banksDb } from '@/mockdata/banks';

export interface CreateBankDTO {
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  is_active?: boolean;
}

export interface CreateAccountTemplateDTO {
  bank_id: string;
  name: string;
  type: AccountTemplate['type'];
  currency?: string;
  maintenance_cost?: number;
  maintenance_currency?: 'CLP' | 'UF';
}

export interface CreateCreditCardTemplateDTO {
  bank_id: string;
  name: string;
  card_network: CreditCardTemplate['card_network'];
  default_maintenance_cost?: number;
  maintenance_currency?: 'CLP' | 'UF';
  default_monthly_interest_rate?: number;
  default_penalty_interest_rate?: number;
}

// Memory cache for mock mode
let localBanksDb = [...banksDb];

// =====================================
// BANCOS (BANKS) ADMIN API
// =====================================

export async function getAllBanksAdmin(): Promise<Bank[]> {
  if (USE_MOCKS) {
    return Promise.resolve([...localBanksDb]);
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('banks') as any)
    .select('id, name, logo_url, primary_color, is_active')
    .order('name');

  if (error) {
    console.error('Error fetching admin banks:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    color: row.primary_color || '#534AB7',
    primary_color: row.primary_color || null,
    logo_url: row.logo_url || null,
    is_active: row.is_active ?? true,
  }));
}

export async function createBankAdmin(dto: CreateBankDTO): Promise<Bank> {
  if (USE_MOCKS) {
    const newBank: Bank = {
      id: `bank-${Math.random().toString(36).substring(2, 9)}`,
      name: dto.name,
      color: dto.primary_color || '#534AB7',
      primary_color: dto.primary_color || null,
      logo_url: dto.logo_url || null,
      is_active: dto.is_active ?? true,
    };
    localBanksDb.push(newBank);
    return newBank;
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('banks') as any)
    .insert([{
      name: dto.name,
      logo_url: dto.logo_url || null,
      primary_color: dto.primary_color || '#534AB7',
      is_active: dto.is_active ?? true,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating bank:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    color: data.primary_color || '#534AB7',
    primary_color: data.primary_color || null,
    logo_url: data.logo_url || null,
    is_active: data.is_active ?? true,
  };
}

export async function updateBankAdmin(id: string, updates: Partial<CreateBankDTO>): Promise<Bank> {
  if (USE_MOCKS) {
    const idx = localBanksDb.findIndex(b => b.id === id);
    if (idx !== -1) {
      localBanksDb[idx] = {
        ...localBanksDb[idx],
        ...updates,
        primary_color: updates.primary_color ?? localBanksDb[idx].primary_color ?? null,
        color: updates.primary_color ?? localBanksDb[idx].color ?? '#534AB7',
      };
      return localBanksDb[idx];
    }
    throw new Error('Banco no encontrado');
  }

  const supabase = createClient();
  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.logo_url !== undefined) dbUpdates.logo_url = updates.logo_url;
  if (updates.primary_color !== undefined) dbUpdates.primary_color = updates.primary_color;
  if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;

  const { data, error } = await (supabase.from('banks') as any)
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating bank:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    color: data.primary_color || '#534AB7',
    primary_color: data.primary_color || null,
    logo_url: data.logo_url || null,
    is_active: data.is_active ?? true,
  };
}

export async function deleteBankAdmin(id: string): Promise<void> {
  if (USE_MOCKS) {
    localBanksDb = localBanksDb.filter(b => b.id !== id);
    return;
  }

  const supabase = createClient();
  const { error } = await (supabase.from('banks') as any).delete().eq('id', id);
  if (error) {
    console.error('Error deleting bank:', error);
    throw error;
  }
}

// =====================================
// SUPABASE STORAGE LOGO UPLOAD
// =====================================

export async function uploadBankLogoAdmin(file: File): Promise<string> {
  if (USE_MOCKS) {
    // Return Object URL for preview in mock mode
    return URL.createObjectURL(file);
  }

  const supabase = createClient();
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `bank-logos/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('bank-logos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error uploading logo to Supabase Storage:', uploadError);
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('bank-logos')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// =====================================
// PLANTILLAS DE CUENTAS (ACCOUNT TEMPLATES)
// =====================================

export async function getAccountTemplatesAdmin(bankId?: string): Promise<AccountTemplate[]> {
  if (USE_MOCKS) {
    return [];
  }

  const supabase = createClient();
  let query = (supabase.from('bank_account_templates') as any)
    .select('id, bank_id, name, type, currency, maintenance_cost, maintenance_currency')
    .order('name');

  if (bankId) {
    query = query.eq('bank_id', bankId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching account templates:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    bank_id: row.bank_id,
    name: row.name,
    type: row.type,
    currency: row.currency || 'CLP',
    maintenance_cost: row.maintenance_cost || 0,
    maintenance_currency: row.maintenance_currency || 'CLP',
  }));
}

export async function createAccountTemplateAdmin(dto: CreateAccountTemplateDTO): Promise<AccountTemplate> {
  if (USE_MOCKS) {
    return {
      id: `act-${Math.random().toString(36).substring(2, 9)}`,
      bank_id: dto.bank_id,
      name: dto.name,
      type: dto.type,
      currency: dto.currency || 'CLP',
      maintenance_cost: dto.maintenance_cost || 0,
      maintenance_currency: dto.maintenance_currency || 'CLP',
    };
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('bank_account_templates') as any)
    .insert([{
      bank_id: dto.bank_id,
      name: dto.name,
      type: dto.type,
      currency: dto.currency || 'CLP',
      maintenance_cost: dto.maintenance_cost ?? 0,
      maintenance_currency: dto.maintenance_currency || 'CLP',
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating account template:', error);
    throw error;
  }

  return {
    id: data.id,
    bank_id: data.bank_id,
    name: data.name,
    type: data.type,
    currency: data.currency || 'CLP',
    maintenance_cost: data.maintenance_cost || 0,
    maintenance_currency: data.maintenance_currency || 'CLP',
  };
}

export async function updateAccountTemplateAdmin(id: string, updates: Partial<CreateAccountTemplateDTO>): Promise<AccountTemplate> {
  if (USE_MOCKS) {
    throw new Error('Not implemented in mock mode');
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('bank_account_templates') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating account template:', error);
    throw error;
  }

  return {
    id: data.id,
    bank_id: data.bank_id,
    name: data.name,
    type: data.type,
    currency: data.currency || 'CLP',
    maintenance_cost: data.maintenance_cost || 0,
    maintenance_currency: data.maintenance_currency || 'CLP',
  };
}

export async function deleteAccountTemplateAdmin(id: string): Promise<void> {
  if (USE_MOCKS) return;

  const supabase = createClient();
  const { error } = await (supabase.from('bank_account_templates') as any).delete().eq('id', id);
  if (error) {
    console.error('Error deleting account template:', error);
    throw error;
  }
}

// =====================================
// PLANTILLAS DE TARJETAS (CREDIT CARD TEMPLATES)
// =====================================

export async function getCreditCardTemplatesAdmin(bankId?: string): Promise<CreditCardTemplate[]> {
  if (USE_MOCKS) {
    return [];
  }

  const supabase = createClient();
  let query = (supabase.from('bank_credit_card_templates') as any)
    .select('id, bank_id, name, card_network, default_maintenance_cost, maintenance_currency, default_monthly_interest_rate, default_penalty_interest_rate')
    .order('name');

  if (bankId) {
    query = query.eq('bank_id', bankId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching credit card templates:', error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    bank_id: row.bank_id,
    name: row.name,
    card_network: row.card_network,
    default_maintenance_cost: row.default_maintenance_cost || 0,
    maintenance_currency: row.maintenance_currency || 'CLP',
    default_monthly_interest_rate: row.default_monthly_interest_rate || 0,
    default_penalty_interest_rate: row.default_penalty_interest_rate || 0,
  }));
}

export async function createCreditCardTemplateAdmin(dto: CreateCreditCardTemplateDTO): Promise<CreditCardTemplate> {
  if (USE_MOCKS) {
    return {
      id: `cct-${Math.random().toString(36).substring(2, 9)}`,
      bank_id: dto.bank_id,
      name: dto.name,
      card_network: dto.card_network,
      default_maintenance_cost: dto.default_maintenance_cost || 0,
      maintenance_currency: dto.maintenance_currency || 'CLP',
      default_monthly_interest_rate: dto.default_monthly_interest_rate || 0,
      default_penalty_interest_rate: dto.default_penalty_interest_rate || 0,
    };
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('bank_credit_card_templates') as any)
    .insert([{
      bank_id: dto.bank_id,
      name: dto.name,
      card_network: dto.card_network,
      default_maintenance_cost: dto.default_maintenance_cost ?? 0,
      maintenance_currency: dto.maintenance_currency || 'CLP',
      default_monthly_interest_rate: dto.default_monthly_interest_rate ?? 0,
      default_penalty_interest_rate: dto.default_penalty_interest_rate ?? 0,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating credit card template:', error);
    throw error;
  }

  return {
    id: data.id,
    bank_id: data.bank_id,
    name: data.name,
    card_network: data.card_network,
    default_maintenance_cost: data.default_maintenance_cost || 0,
    maintenance_currency: data.maintenance_currency || 'CLP',
    default_monthly_interest_rate: data.default_monthly_interest_rate || 0,
    default_penalty_interest_rate: data.default_penalty_interest_rate || 0,
  };
}

export async function updateCreditCardTemplateAdmin(id: string, updates: Partial<CreateCreditCardTemplateDTO>): Promise<CreditCardTemplate> {
  if (USE_MOCKS) {
    throw new Error('Not implemented in mock mode');
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('bank_credit_card_templates') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating credit card template:', error);
    throw error;
  }

  return {
    id: data.id,
    bank_id: data.bank_id,
    name: data.name,
    card_network: data.card_network,
    default_maintenance_cost: data.default_maintenance_cost || 0,
    maintenance_currency: data.maintenance_currency || 'CLP',
    default_monthly_interest_rate: data.default_monthly_interest_rate || 0,
    default_penalty_interest_rate: data.default_penalty_interest_rate || 0,
  };
}

export async function deleteCreditCardTemplateAdmin(id: string): Promise<void> {
  if (USE_MOCKS) return;

  const supabase = createClient();
  const { error } = await (supabase.from('bank_credit_card_templates') as any).delete().eq('id', id);
  if (error) {
    console.error('Error deleting credit card template:', error);
    throw error;
  }
}
