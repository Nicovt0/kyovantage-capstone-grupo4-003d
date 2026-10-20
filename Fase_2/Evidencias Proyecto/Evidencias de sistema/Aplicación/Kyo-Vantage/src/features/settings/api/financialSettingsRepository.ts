import { createClient } from '@/utils/supabase/client';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';

export interface FinancialSettings { financial_cycle_start_day: number; monthly_estimated_income: number; }
export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = { financial_cycle_start_day: 1, monthly_estimated_income: 0 };
let mockSettings = { ...DEFAULT_FINANCIAL_SETTINGS };
export async function getFinancialSettings(): Promise<FinancialSettings> {
  if (USE_MOCKS) return { ...mockSettings };
  const client = createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Inicia sesión para cargar tus preferencias financieras.');
  const { data, error } = await client.from('profiles').select('financial_cycle_start_day,monthly_estimated_income').eq('id', user.id).single();
  if (error) throw new Error(`No se pudieron cargar tus preferencias financieras: ${error.message}`);
  return { financial_cycle_start_day: Number(data.financial_cycle_start_day ?? 1), monthly_estimated_income: Number(data.monthly_estimated_income ?? 0) };
}
export async function saveFinancialSettings(settings: FinancialSettings): Promise<FinancialSettings> {
  const day = Number(settings.financial_cycle_start_day);
  const income = Number(settings.monthly_estimated_income);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('El día de inicio debe estar entre 1 y 31.');
  if (!Number.isFinite(income) || income < 0 || !Number.isSafeInteger(income)) throw new Error('Ingresa un monto mensual válido en pesos, sin decimales.');
  const payload = { financial_cycle_start_day: day, monthly_estimated_income: income };
  if (USE_MOCKS) { mockSettings = payload; return payload; }
  const client = createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Inicia sesión para guardar tus preferencias financieras.');
  const { data, error } = await client.from('profiles').update(payload).eq('id', user.id).select('financial_cycle_start_day,monthly_estimated_income').single();
  if (error) throw new Error(`No se pudieron guardar tus preferencias financieras: ${error.message}`);
  return { financial_cycle_start_day: Number(data.financial_cycle_start_day), monthly_estimated_income: Number(data.monthly_estimated_income) };
}
