import { localGoalDate } from '../model/goalPlan.ts';
import { Goal } from "@/types";
import { goalsDb } from '@/mockdata/goals';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";
import { createNotification } from "@/features/notifications/api/notificationRepository";

const mapPriorityToDb = (priority?: string): 'low' | 'medium' | 'high' => {
  if (priority === 'high') return 'high';
  if (priority === 'mid' || priority === 'medium') return 'medium';
  return 'low';
};

const mapDbPriorityToTs = (priority?: string): 'high' | 'mid' | 'low' => {
  if (priority === 'high') return 'high';
  if (priority === 'medium' || priority === 'mid') return 'mid';
  return 'low';
};

const normalizeGoal = (g: any): Goal => ({
  id:g.id, user_id:g.user_id, name:g.name, savings_account_id:g.savings_account_id ?? null,
  target_amount:Number(g.target_amount), current_amount:Number(g.current_amount || 0),
  start_date:g.start_date, deadline_date:g.deadline_date,plan_start_date:g.plan_start_date,
  contribution_type:['auto','fixed','free'].includes(g.contribution_type) ? g.contribution_type : 'auto',
  contribution_amount:Number(g.contribution_amount || 0),
  priority:mapDbPriorityToTs(g.priority), reminders:g.reminders ?? true,
  color:g.color || '#534AB7', icon_name:g.icon_name || 'Target',
});

function assertGoalWrite(error: any): void {
  if (!error) return;
  if (['42703','PGRST204'].includes(error.code)) throw new Error('Staging necesita las migraciones de metas, incluida 20261019000002_goal_savings_account.sql.');
  throw new Error(error.message || 'No se pudo guardar la meta.');
}

export const getGoals = async (): Promise<Goal[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...goalsDb]), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await (supabase.from('goals') as any).select('*');
  if (error) {
    throw new Error(`No se pudieron cargar tus metas. ${error.message || 'Intenta nuevamente.'}`);
  }

  return (data || []).map(normalizeGoal);
};

export const addGoal = async (goal: Omit<Goal, 'id'>): Promise<Goal> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newGoal = {
          ...goal,
          id: `goal-${Math.random().toString(36).substr(2, 9)}`
        };
        goalsDb.push(newGoal);
        resolve(newGoal);
      }, 100);
    });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  // Límite de 5 metas para la versión Beta
  const { count } = await (supabase
    .from('goals') as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count !== null && count >= 5) {
    throw new Error('Límite de la versión Beta: No puedes crear más de 5 metas.');
  }

  const dbPayload = {
    user_id: user.id,
    savings_account_id: goal.savings_account_id || null,
    name: goal.name,
    target_amount: goal.target_amount,
    current_amount: goal.current_amount || 0,
    start_date: goal.start_date || new Date().toISOString(),
    deadline_date: goal.deadline_date,
    contribution_type: goal.contribution_type,
    contribution_amount: goal.contribution_type === 'free' ? 0 : goal.contribution_amount,
    reminders: goal.contribution_type === 'free' ? false : goal.reminders,
    priority: mapPriorityToDb(goal.priority),
    color: goal.color || '#534AB7',
    icon_name: goal.icon_name || 'Target',
  };

  const { data, error } = await (supabase
    .from('goals') as any)
    .insert([dbPayload])
    .select()
    .single();

  assertGoalWrite(error);

  try {
    await createNotification({type:'system',title:'Meta Creada',message:`Has creado la meta de ahorro "${goal.name}".`});
  } catch (error) { console.error('Meta guardada; falló su notificación.',error); }

  return normalizeGoal(data);
};

export const updateGoal = async (id: string, updates: Partial<Goal>): Promise<Goal> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = goalsDb.findIndex(g => g.id === id);
        if (index !== -1) {
          const old=goalsDb[index];
          const planChanged=(updates.target_amount!==undefined && updates.target_amount!==old.target_amount)
            || (updates.deadline_date!==undefined && updates.deadline_date!==old.deadline_date)
            || (updates.contribution_type!==undefined && updates.contribution_type!==old.contribution_type)
            || (old.contribution_type==='fixed' && updates.contribution_amount!==undefined && updates.contribution_amount!==old.contribution_amount);
          goalsDb[index] = { ...old, ...updates, ...(planChanged ? {plan_start_date:localGoalDate()} : {}) };
          resolve({ ...goalsDb[index] });
        } else {
          reject(new Error("Goal not found"));
        }
      }, 100);
    });
  }

  const supabase = createClient();

  const dbUpdates: Record<string, any> = {};
  if (updates.savings_account_id !== undefined) dbUpdates.savings_account_id = updates.savings_account_id;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.target_amount !== undefined) dbUpdates.target_amount = updates.target_amount;
  if (updates.current_amount !== undefined) dbUpdates.current_amount = updates.current_amount;
  if (updates.deadline_date !== undefined) dbUpdates.deadline_date = updates.deadline_date;
  if (updates.contribution_type !== undefined) dbUpdates.contribution_type = updates.contribution_type;
  if (updates.contribution_amount !== undefined) dbUpdates.contribution_amount = updates.contribution_amount;
  if (updates.reminders !== undefined) dbUpdates.reminders = updates.reminders;
  if (updates.contribution_type === 'free') { dbUpdates.contribution_amount = 0; dbUpdates.reminders = false; }
  if (updates.priority !== undefined) dbUpdates.priority = mapPriorityToDb(updates.priority);
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.icon_name !== undefined) dbUpdates.icon_name = updates.icon_name;

  const { data, error } = await (supabase
    .from('goals') as any)
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  assertGoalWrite(error);

  if (updates.name || updates.target_amount) {
    try {
      await createNotification({type:'system',title:'Meta Actualizada',message:`Se ha modificado la meta de ahorro "${data.name}".`});
    } catch (error) { console.error('Meta guardada; falló su notificación.',error); }
  }

  return normalizeGoal(data);
};

export const deleteGoal = async (id: string): Promise<void> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = goalsDb.findIndex(g => g.id === id);
        if (index !== -1) {
          goalsDb.splice(index, 1);
        }
        resolve();
      }, 100);
    });
  }

  const supabase = createClient();

  await (supabase.from('transactions') as any).delete().eq('goal_id', id).eq('status', 'pending');
  await (supabase.from('transactions') as any).update({ goal_id: null }).eq('goal_id', id);

  const { error } = await (supabase.from('goals') as any).delete().eq('id', id);
  if (error) throw error;

  await createNotification({
    type: 'system',
    title: 'Meta Eliminada',
    message: `Has eliminado una meta de ahorro.`
  });
};
