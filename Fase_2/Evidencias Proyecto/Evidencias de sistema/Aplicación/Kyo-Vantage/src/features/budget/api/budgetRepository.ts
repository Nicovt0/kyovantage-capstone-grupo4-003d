import { getFinancialSettings } from '@/features/settings/api/financialSettingsRepository';
import { Budget } from "@/types";
import { budgetsDb } from '@/mockdata/budgets';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";
import { createNotification } from "@/features/notifications/api/notificationRepository";
import { getBudgetPeriodDates } from '@/utils/budgetEngine';

const mapPeriodToDb = (period?: string): 'weekly' | 'monthly' | 'yearly' => {
  if (period === 'annual' || period === 'yearly') return 'yearly';
  if (period === 'weekly') return 'weekly';
  return 'monthly';
};

const mapDbPeriodToTs = (periodicity?: string): 'weekly' | 'monthly' | 'annual' => {
  if (periodicity === 'yearly') return 'annual';
  if (periodicity === 'weekly') return 'weekly';
  return 'monthly';
};

export const getBudgets = async (): Promise<Budget[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...budgetsDb]), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase.from('budgets').select('*');
  if (error) {
    console.error('Error fetching budgets:', error);
    return [];
  }
  
  return (data || []).map(b => ({
    id: b.id,
    user_id: b.user_id,
    category_id: b.category_id,
    limit_amount: Number(b.limit_amount),
    period: mapDbPeriodToTs(b.periodicity),
    recurrent: true,
    rollover: false,
    alert_threshold: Number(b.alert_threshold ?? 80),
  })) as Budget[];
};

export const getBudgetById = async (id: string): Promise<Budget | null> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const b = budgetsDb.find(b => b.id === id);
        resolve(b || null);
      }, 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase.from('budgets').select('*').eq('id', id).single();
  if (error || !data) {
    console.error(`Error fetching budget ${id}:`, error);
    return null;
  }

  return {
    id: data.id,
    user_id: data.user_id,
    category_id: data.category_id,
    limit_amount: Number(data.limit_amount),
    period: mapDbPeriodToTs(data.periodicity),
    recurrent: true,
    rollover: false,
    alert_threshold: Number(data.alert_threshold ?? 80),
  } as Budget;
};

export const addBudget = async (budget: Omit<Budget, 'id'>): Promise<Budget> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newBudget = {
          ...budget,
          id: `budget-${Math.random().toString(36).substr(2, 9)}`
        };
        budgetsDb.push(newBudget);
        resolve(newBudget);
      }, 100);
    });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  // Límite de 5 presupuestos para la versión Beta
  const { count } = await supabase
    .from('budgets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count !== null && count >= 5) {
    throw new Error('Límite de la versión Beta: No puedes crear más de 5 presupuestos.');
  }

  const dbPayload = {
    user_id: user.id,
    category_id: budget.category_id,
    limit_amount: budget.limit_amount,
    periodicity: mapPeriodToDb(budget.period),
    alert_threshold: budget.alert_threshold ?? 80,
  };

  const { data, error } = await supabase
    .from('budgets')
    .insert([dbPayload])
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'system',
    title: 'Presupuesto Creado',
    message: `Has creado un nuevo presupuesto.`
  });

  return {
    id: data.id,
    user_id: data.user_id,
    category_id: data.category_id,
    limit_amount: Number(data.limit_amount),
    period: mapDbPeriodToTs(data.periodicity),
    recurrent: true,
    rollover: false,
    alert_threshold: Number(data.alert_threshold ?? 80),
  };
};

export const updateBudget = async (id: string, updates: Partial<Budget>): Promise<Budget> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = budgetsDb.findIndex(b => b.id === id);
        if (idx === -1) return reject(new Error('Budget not found'));
        budgetsDb[idx] = { ...budgetsDb[idx], ...updates };
        resolve(budgetsDb[idx]);
      }, 100);
    });
  }

  const supabase = createClient();
  
  const dbUpdates: Record<string, any> = {};
  if (updates.limit_amount !== undefined) dbUpdates.limit_amount = updates.limit_amount;
  if (updates.category_id !== undefined) dbUpdates.category_id = updates.category_id;
  if (updates.period !== undefined) dbUpdates.periodicity = mapPeriodToDb(updates.period);
  if (updates.alert_threshold !== undefined) dbUpdates.alert_threshold = updates.alert_threshold;

  const { data, error } = await supabase
    .from('budgets')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (updates.limit_amount) {
    await createNotification({
      type: 'system',
      title: 'Presupuesto Actualizado',
      message: `Se ha modificado el límite de tu presupuesto.`
    });
  }

  return {
    id: data.id,
    user_id: data.user_id,
    category_id: data.category_id,
    limit_amount: Number(data.limit_amount),
    period: mapDbPeriodToTs(data.periodicity),
    recurrent: true,
    rollover: false,
    alert_threshold: Number(data.alert_threshold ?? 80),
  };
};

export const deleteBudget = async (id: string): Promise<void> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = budgetsDb.findIndex(b => b.id === id);
        if (idx === -1) return reject(new Error('Budget not found'));
        budgetsDb.splice(idx, 1);
        resolve();
      }, 100);
    });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await createNotification({
    type: 'system',
    title: 'Presupuesto Eliminado',
    message: `Has eliminado un presupuesto.`
  });
};

export const checkBudgetLimits = async (categoryId: string, _addedAmount: number): Promise<void> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: budgets, error: budgetsError } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id)
    .eq('category_id', categoryId);

  if (budgetsError) throw budgetsError;
  if (!budgets?.length) return;

  const { financial_cycle_start_day: cycleStartDay } = await getFinancialSettings();
  for (const budget of budgets) {
  const now = new Date();
  const { start, end } = getBudgetPeriodDates(mapDbPeriodToTs(budget.periodicity), now, cycleStartDay);

  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('category_id', categoryId)
    .eq('type', 'expense')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString());

  if (transactionsError) throw transactionsError;
  const currentMonthSpent = (transactions ?? []).reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

  const limit = Number(budget.limit_amount);
  const threshold = budget.alert_threshold ?? 80;
  const percentage = (currentMonthSpent / limit) * 100;

  if (percentage > 100) {
    await createNotification({
      type: 'budget',
      title: 'Presupuesto Superado',
      message: `Has superado el 100% de tu presupuesto para esta categoría. Total gastado: $${currentMonthSpent.toLocaleString('es-CL')}.`
    });
  } else if (threshold > 0 && percentage >= threshold) {
    await createNotification({
      type: 'budget',
      title: 'Alerta de Presupuesto',
      message: `Has alcanzado el ${Math.round(percentage)}% de tu presupuesto. Total gastado: $${currentMonthSpent.toLocaleString('es-CL')}.`
    });
  }
  }
};
