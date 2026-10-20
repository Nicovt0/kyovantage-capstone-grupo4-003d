import { createClient } from "@/utils/supabase/client";
import { RecurringTemplate } from "@/types";
import { createNotification } from "@/features/notifications/api/notificationRepository";

import { USE_MOCKS } from '@/shared/lib/serviceConfig';

// Estado temporal de mocks y locks de generación, siempre en memoria.
let recurringDb: RecurringTemplate[] = [];
const generationLocks = new Set<string>();

export const getRecurringTemplates = async (): Promise<RecurringTemplate[]> => {
  if (USE_MOCKS) {
    return recurringDb;
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', user.id);

  if (error) return [];
  return ((data || []) as RecurringTemplate[]).filter(template=>!template.goal_id);
};

export const addRecurringTemplate = async (template: Omit<RecurringTemplate, 'id'>): Promise<RecurringTemplate> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (USE_MOCKS) {
    const newTemplate = { ...template, id: Math.random().toString(36).substr(2, 9), user_id: user?.id };
    recurringDb.push(newTemplate);
    return newTemplate;
  }

  if (!user) throw new Error("No authenticated user");

  const { data, error } = await supabase
    .from('recurring_templates')
    .insert([{ ...template, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'creation',
    title: 'Agenda Financiera',
    message: `Has programado un nuevo ${template.type === 'expense' ? 'gasto fijo' : 'ingreso fijo'} "${template.name}".`
  });

  return data as RecurringTemplate;
};

export const updateRecurringTemplate = async (id: string, updates: Partial<RecurringTemplate>): Promise<void> => {
  if (USE_MOCKS) {
    recurringDb = recurringDb.map(t => t.id === id ? { ...t, ...updates } : t);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from('recurring_templates').update(updates).eq('id', id);
  if (error) throw error;

  if (updates.name || updates.expected_amount) {
    await createNotification({
      type: 'system',
      title: 'Agenda Financiera',
      message: `Se ha modificado el registro programado "${updates.name || 'seleccionado'}".`
    });
  }
};

export const deleteRecurringTemplate = async (id: string): Promise<void> => {
  if (USE_MOCKS) {
    recurringDb = recurringDb.filter(t => t.id !== id);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from('recurring_templates').delete().eq('id', id);
  if (error) throw error;

  await createNotification({
    type: 'system',
    title: 'Agenda Financiera',
    message: `Has eliminado un ítem de tu agenda.`
  });
};

let generatePromise: Promise<void> | null = null;

export const checkAndGenerateRecurringTransactions = async (): Promise<void> => {
  if (generatePromise) {
    return generatePromise;
  }

  generatePromise = (async () => {
    try {
      const templates = await getRecurringTemplates();
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      const { addTransaction, getTransactions } = await import('@/features/wallet/api/transactionRepository');
      const allTransactions = await getTransactions();
      let generatedCount = 0;

      // Process templates sequentially or with a lock to avoid race conditions further
      for (const template of templates) {
        // 1. Check if already generated for this month
        if (template.last_generated_month === currentMonthStr) continue;

        const lockKey = `recurring_gen_${currentMonthStr}_${template.id}`;
        if (generationLocks.has(lockKey)) continue;
        generationLocks.add(lockKey);

        // 2. Calcular el día real (manejar meses de 28, 29 o 30 días)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const actualDay = Math.min(template.day_of_month ?? 1, lastDayOfMonth);

        const targetDate = new Date(now.getFullYear(), now.getMonth(), actualDay);
        const leadWindowDate = new Date(targetDate);
        leadWindowDate.setDate(targetDate.getDate() - (template.lead_days ?? 0));

        if (now >= leadWindowDate) {
          // 3. Verify it hasn't been created manually or by another session (extra safety)
          // Removed status === 'pending' check so it doesn't duplicate if user already paid it
          const alreadyExists = allTransactions.some(t =>
            t.name === template.name &&
            t.date.startsWith(currentMonthStr)
          );

          if (!alreadyExists) {
            // Execute creation and update
            await addTransaction({
              account_id: template.account_id ?? undefined,
              category_id: template.category_id || '',
              name: template.name,
              amount: template.expected_amount,
              type: template.type,
              status: 'pending',
              date: targetDate.toISOString(),
              due_date: targetDate.toISOString(),
              is_recurring: true,
              validated_at: null
            }, true); // Suppress individual notification
            await updateRecurringTemplate(template.id, { last_generated_month: currentMonthStr });
            generatedCount++;
          }
        }
      }

      if (generatedCount > 0) {
        await createNotification({
          type: 'alert',
          title: 'Agenda Financiera',
          message: `Se han agregado ${generatedCount} registros pendientes a tu billetera para este mes.`
        });
      }

      // Goal commitments are now projected by get_goal_agenda_occurrences; never create pending transactions here.
    } finally {
      generatePromise = null;
    }
  })();

  return generatePromise;
};
