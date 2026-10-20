import { getGoalAgendaOccurrences, payGoalOccurrence } from '../../../features/goals/api/goalAgendaRepository.ts';
import { createClient as getClient } from '../../../utils/supabase/client.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RecurringTemplate,
  CreateRecurringTemplateDTO,
  UpdateRecurringTemplateDTO,
  RecurringFrequency,
  RecurringStatus,
  Account,
  CreditCard,
  Category,
} from '../../../types/index.ts';
import { USE_MOCKS } from '../../../shared/lib/serviceConfig.ts';
import { recurringTemplatesDb } from '../../../mockdata/recurringTemplates.ts';
import { accountsDb } from '../../../mockdata/accounts.ts';
import { transactionsDb } from '../../../mockdata/transactions.ts';
// This repository supports the verified staging schema without generated DB types.
const createClient = (): SupabaseClient => getClient() as SupabaseClient;

/**
 * Custom error class providing explicit Supabase diagnostic details.
 */
export class SupabaseRepositoryError extends Error {
  code?: string;
  details?: string;
  hint?: string;

  constructor(operation: string, error: { message: string; code?: string; details?: string; hint?: string }) {
    const parts = [`[Agenda eventRepository - ${operation}] ${error.message}`];
    if (error.details) parts.push(`Detalles: ${error.details}`);
    if (error.hint) parts.push(`Pista: ${error.hint}`);
    if (error.code) parts.push(`Código: ${error.code}`);
    super(parts.join(' | '));
    this.name = 'SupabaseRepositoryError';
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

/**
 * Robust calendar date parser avoiding timezone shift pitfalls.
 */
export function parseDateOnly(dateOrStr: string | Date): { year: number; month: number; day: number } {
  if (typeof dateOrStr === 'string') {
    const match = dateOrStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
      };
    }
  }
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  };
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 */
export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calculates a guaranteed non-null next_due_date (YYYY-MM-DD) based on frequency, payment day, and optional due date.
 * Prevents PostgreSQL not-null constraint violations (code 23502) on the next_due_date column.
 */
export function calculateNextDueDate(params: {
  frequency?: string | null;
  paymentDay?: number | null;
  dueDate?: string | Date | null;
}): string {
  if (params.dueDate) {
    const parsed = parseDateOnly(params.dueDate);
    return `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
  }

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  const rawDay = params.paymentDay ?? 1;
  const day = Math.max(1, Math.min(31, rawDay));

  if (params.frequency === 'monthly') {
    let targetYear = currentYear;
    let targetMonth = currentMonth;

    // If today is past the payment day, the next occurrence is next month
    if (currentDay > day) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const actualDay = Math.min(day, lastDayOfMonth);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
  }

  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const actualDay = Math.min(day, lastDay);
  return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}

/**
 * Determines whether a recurring template falls within a given date cycle [startDate, endDate],
 * returning the exact occurrence Date if it matches, or null otherwise.
 */
export function getOccurrenceInDateRange(
  template: {
    frequency?: string | null;
    payment_day?: number | null;
    day_of_month?: number | null;
    due_date?: string | Date | null;
    next_due_date?: string | Date | null;
    is_active?: boolean | null;
    created_at?: string | Date | null;
  },
  startDate: Date | string,
  endDate: Date | string
): Date | null {
  if (template.is_active === false) {
    return null;
  }

  let startParsed = parseDateOnly(startDate);
  const endParsed = parseDateOnly(endDate);

  // Creation is the stable anchor; next_due_date can change after editing.
  // Explicit one-off dates can legitimately be registered retrospectively.
  if(template.frequency!=='once') {
    const firstDate=recurringCreationDate(template);
    if(firstDate && firstDate>formatDateOnly(new Date(startParsed.year,startParsed.month,startParsed.day))) startParsed=parseDateOnly(firstDate);
  }

  const start = new Date(startParsed.year, startParsed.month, startParsed.day, 0, 0, 0, 0);
  const end = new Date(endParsed.year, endParsed.month, endParsed.day, 23, 59, 59, 999);

  const frequency = template.frequency || 'monthly';
  const rawDueDate = template.due_date || template.next_due_date;

  if (frequency === 'once') {
    if (!rawDueDate) return null;
    const { year, month, day } = parseDateOnly(rawDueDate);
    const occurrence = new Date(year, month, day, 12, 0, 0, 0);
    return occurrence >= start && occurrence <= end ? occurrence : null;
  }

  if (frequency === 'monthly') {
    const rawDay =
      template.payment_day ??
      template.day_of_month ??
      (rawDueDate ? parseDateOnly(rawDueDate).day : 1);
    const day = Math.max(1, Math.min(31, rawDay));

    let y = startParsed.year;
    let m = startParsed.month;
    const endYear = endParsed.year;
    const endMonth = endParsed.month;

    while (y < endYear || (y === endYear && m <= endMonth)) {
      const lastDay = new Date(y, m + 1, 0).getDate();
      const actualDay = Math.min(day, lastDay);
      const occurrence = new Date(y, m, actualDay, 12, 0, 0, 0);

      if (occurrence >= start && occurrence <= end) {
        return occurrence;
      }

      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    return null;
  }

  if (frequency === 'yearly') {
    if (!rawDueDate) return null;
    const { month, day } = parseDateOnly(rawDueDate);

    for (let y = startParsed.year; y <= endParsed.year; y++) {
      const lastDay = new Date(y, month + 1, 0).getDate();
      const actualDay = Math.min(day, lastDay);
      const occurrence = new Date(y, month, actualDay, 12, 0, 0, 0);

      if (occurrence >= start && occurrence <= end) {
        return occurrence;
      }
    }

    return null;
  }

  // Fallback for custom or unspecified frequencies with a fixed due_date
  if (rawDueDate) {
    const { year, month, day } = parseDateOnly(rawDueDate);
    const occurrence = new Date(year, month, day, 12, 0, 0, 0);
    return occurrence >= start && occurrence <= end ? occurrence : null;
  }

  return null;
}

/** Recurrence dates use the app's Santiago calendar, not the UTC date of registration. */
export function recurringCreationDate(template:{created_at?:string|Date|null;due_date?:string|Date|null;next_due_date?:string|Date|null}):string|null {
  const value=template.created_at;
  if(value) {
    if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value))return value;
    const date=value instanceof Date ? value:new Date(value);
    if(!Number.isNaN(date.getTime())) {
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
      const part=(type:string)=>parts.find(item=>item.type===type)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    }
  }
  const fallback=template.next_due_date || template.due_date;
  if(!fallback)return null;
  const parsed=parseDateOnly(fallback);
  return formatDateOnly(new Date(parsed.year,parsed.month,parsed.day));
}

/** A financial cycle can contain two occurrences when its cutoff is clamped in February. */
export function getOccurrencesInDateRange(template: Parameters<typeof getOccurrenceInDateRange>[0], startDate: Date, endDate: Date): Date[] {
  const result: Date[] = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const occurrence = getOccurrenceInDateRange(template, cursor, endDate);
    if (!occurrence) break;
    result.push(occurrence);
    cursor = new Date(occurrence);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
    if (template.frequency === 'once') break;
  }
  return result;
}

/**
 * Normalizes a raw database row into the strongly typed RecurringTemplate entity,
 * safely extracting joined relations or providing defaults.
 */
export function normalizeRecurringTemplate(row: any): RecurringTemplate {
  const account: Account | null = Array.isArray(row.account)
    ? (row.account[0] ?? null)
    : (row.account ?? null);

  const creditCard: CreditCard | null = Array.isArray(row.credit_card)
    ? (row.credit_card[0] ?? null)
    : (row.credit_card ?? null);

  const category: Category | null = Array.isArray(row.category)
    ? (row.category[0] ?? null)
    : (row.category ?? null);

  const title = String(row.name || row.title || 'Compromiso');
  const name = String(row.name || row.title || 'Compromiso');
  // Canonical database column is expected_amount
  const expectedAmount = Number(row.expected_amount ?? row.amount ?? 0);
  const amount = expectedAmount;

  const frequency: RecurringFrequency =
    row.frequency === 'once' || row.frequency === 'yearly' ? row.frequency : 'monthly';

  const status: RecurringStatus =
    row.status === 'paid' || row.status === 'overdue' ? row.status : 'pending';

  const paymentDay = row.day_of_month ?? row.payment_day ?? null;
  const dayOfMonth = row.day_of_month ?? row.payment_day ?? (paymentDay ? Number(paymentDay) : undefined);

  const dueDate = row.next_due_date
    ? String(row.next_due_date).split('T')[0]
    : row.due_date
    ? String(row.due_date).split('T')[0]
    : null;

  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : undefined,
    title,
    name,
    amount,
    expected_amount: expectedAmount,
    frequency,
    status,
    due_date: dueDate,
    next_due_date: dueDate,
    payment_day: paymentDay !== null ? Number(paymentDay) : null,
    day_of_month: dayOfMonth !== undefined ? Number(dayOfMonth) : undefined,
    account_id: row.account_id ? String(row.account_id) : null,
    credit_card_id: row.credit_card_id ? String(row.credit_card_id) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    type: row.type === 'income' ? 'income' : 'expense',
    is_essential: Boolean(row.is_essential),
    is_active: row.is_active !== false,
    lead_days: row.lead_days ? Number(row.lead_days) : 5,
    last_generated_month: row.last_generated_month ?? null,
    goal_id: row.goal_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    account,
    credit_card: creditCard,
    category,
  };
}

/**
 * Hydrates relational accounts and credit cards when Supabase join is unavailable.
 */
async function hydrateRelationalEntities(
  supabase: ReturnType<typeof createClient>,
  templates: RecurringTemplate[]
): Promise<RecurringTemplate[]> {
  const accountIds = Array.from(
    new Set(templates.map((t) => t.account_id).filter((id): id is string => Boolean(id)))
  );
  const cardIds = Array.from(
    new Set(templates.map((t) => t.credit_card_id).filter((id): id is string => Boolean(id)))
  );

  const accountsMap = new Map<string, Account>();
  const cardsMap = new Map<string, CreditCard>();

  if (accountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .in('id', accountIds);
    if (accountsData) {
      accountsData.forEach((acc) => accountsMap.set(acc.id, acc as Account));
    }
  }

  if (cardIds.length > 0) {
    const { data: cardsData } = await supabase
      .from('credit_cards')
      .select('*')
      .in('id', cardIds);
    if (cardsData) {
      cardsData.forEach((c) => cardsMap.set(c.id, c as CreditCard));
    }
  }

  return templates.map((template) => ({
    ...template,
    account: template.account_id ? accountsMap.get(template.account_id) ?? null : null,
    credit_card: template.credit_card_id ? cardsMap.get(template.credit_card_id) ?? null : null,
  }));
}

/**
 * Obtains the active commitments for the specified cycle [startDate, endDate],
 * fully hydrating linked bank accounts and credit cards.
 *
 * @param userId - The ID of the authenticated user
 * @param startDate - The starting date of the cycle
 * @param endDate - The ending date of the cycle
 */
export async function getUpcomingTemplates(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<RecurringTemplate[]> {
  const supabase = createClient();
  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      resolvedUserId = user.id;
    } else if (!USE_MOCKS) {
      return [];
    }
  }

  if (USE_MOCKS) {
    const userMocks = recurringTemplatesDb.filter((t) => t.user_id === resolvedUserId || !t.user_id);
    const matching: RecurringTemplate[] = [];

    for (const t of userMocks) {
      for (const occurrence of getOccurrencesInDateRange(t, startDate, endDate)) {
        matching.push({
          ...t,
          due_date: formatDateOnly(occurrence),
        });
      }
    }

    matching.push(...await getGoalAgendaOccurrences(startDate,endDate));
    return matching.sort((a, b) => {
      const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return dateA - dateB;
    });
  }

  // Try direct relational join first
  // Note: we do not filter .eq('is_active', true) in SQL to avoid excluding rows where is_active is NULL;
  // JavaScript normalization handles template.is_active !== false reliably.
  const { data, error } = await supabase
    .from('recurring_templates')
    .select(`
      *,
      account:accounts(*),
      credit_card:credit_cards(*),
      category:categories(*)
    `)
    .eq('user_id', resolvedUserId);

  const rawRows = data;

  if (error) {
    // Graceful fallback to separate queries if relational cache hasn't loaded
    console.warn('[getUpcomingTemplates] Join select failed, executing fallback hydration:', error.message);
    const fallback = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('user_id', resolvedUserId);

    if (fallback.error) {
      throw new SupabaseRepositoryError('getUpcomingTemplates', fallback.error);
    }

    const normalizedFallback = (fallback.data || []).map(normalizeRecurringTemplate);
    const hydratedFallback = await hydrateRelationalEntities(supabase, normalizedFallback);
    return [...await filterAndSortTemplatesForRange(hydratedFallback, startDate, endDate), ...await getGoalAgendaOccurrences(startDate,endDate)].sort((a,b)=>(a.due_date || '').localeCompare(b.due_date || ''));
  }

  const normalized = (rawRows || []).map(normalizeRecurringTemplate);
  return [...await filterAndSortTemplatesForRange(normalized, startDate, endDate), ...await getGoalAgendaOccurrences(startDate,endDate)].sort((a,b)=>(a.due_date || '').localeCompare(b.due_date || ''));
}

async function filterAndSortTemplatesForRange(
  templates: RecurringTemplate[],
  startDate: Date,
  endDate: Date
): Promise<RecurringTemplate[]> {
  const result: RecurringTemplate[] = [];

  for (const template of templates) {
    if (template.goal_id) continue; // Its authoritative occurrence comes from the linked goal plan.
    for (const occurrence of getOccurrencesInDateRange(template, startDate, endDate)) {
      result.push({
        ...template,
        due_date: formatDateOnly(occurrence),
      });
    }
  }

  const ordinaryTemplates=templates.filter(template=>!template.goal_id);
  if (ordinaryTemplates.length && !USE_MOCKS) {
    const { data: payments, error } = await createClient()
      .from('agenda_occurrence_payments')
      .select('template_id, occurrence_date, transaction_id')
      .in('template_id', ordinaryTemplates.map((event) => event.id))
      .gte('occurrence_date', formatDateOnly(startDate))
      .lte('occurrence_date', formatDateOnly(endDate));
    if (error) throw new SupabaseRepositoryError('Cargar pagos de agenda (requiere migración)', error);
    // A confirmed legacy receipt is history, even if it predates the corrected anchor.
    for(const payment of payments || []) {
      if(result.some(event=>event.id===payment.template_id && event.due_date===payment.occurrence_date))continue;
      const template=ordinaryTemplates.find(item=>item.id===payment.template_id);
      if(template)result.push({...template,due_date:payment.occurrence_date,status:'paid',payment_transaction_id:payment.transaction_id});
    }
    for (const event of result) {
      const payment = payments?.find((row) => row.template_id === event.id && row.occurrence_date === event.due_date);
      if (payment) {
        event.status = 'paid';
        event.payment_transaction_id = payment.transaction_id;
      } else if (event.frequency !== 'once' && event.status === 'paid') {
        // A legacy global flag cannot make every future occurrence paid.
        event.status = 'pending';
      }
    }
  }

  return result.sort((a, b) => {
    const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
    const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
    return dateA - dateB;
  });
}

let _hasStatusColumn: boolean | null = null;

export async function payAgendaOccurrence(input: {
  id: string;
  occurrenceDate: string;
  accountId: string;
  amount?: number;
  savingsAccountId?: string;
}): Promise<string> {
  if (!input.id || !/^\d{4}-\d{2}-\d{2}$/.test(input.occurrenceDate) || !input.accountId) {
    throw new Error('Selecciona un compromiso, una fecha y una cuenta de pago.');
  }

  if (input.id.startsWith('goal:')) return payGoalOccurrence(input);

  if (USE_MOCKS) {
    const idx = recurringTemplatesDb.findIndex((t) => t.id === input.id);
    const template = idx !== -1 ? recurringTemplatesDb[idx] : null;
    const payAmount = input.amount && input.amount > 0 ? input.amount : Number(template?.amount ?? template?.expected_amount ?? 0);
    if (idx !== -1) {
      recurringTemplatesDb[idx] = {
        ...recurringTemplatesDb[idx],
        status: 'paid',
        payment_transaction_id: `tx-paid-${Date.now()}`,
      };
    }
    const acc = accountsDb.find((a) => a.id === input.accountId);
    if (acc) {
      acc.balance = (acc.balance || 0) - payAmount;
      acc.current_balance = acc.balance;
    }
    transactionsDb.push({
      id: `tx-agenda-${Date.now()}`,
      account_id: input.accountId,
      amount: payAmount,
      type: 'expense',
      date: new Date().toISOString(),
      name: template?.name || template?.title || 'Pago de compromiso de agenda',
      status: 'paid',
      category_id: template?.category_id || 'cat-expense',
    });
    return `tx-agenda-${Date.now()}`;
  }

  const rpcParams: Record<string, unknown> = {
    p_template_id: input.id,
    p_occurrence_date: input.occurrenceDate,
    p_account_id: input.accountId,
  };
  if (input.amount !== undefined && input.amount > 0) {
    rpcParams.p_amount = input.amount;
  }

  const { data, error } = await createClient().rpc('pay_agenda_occurrence', rpcParams);
  if (error) throw new SupabaseRepositoryError('Registrar pago de agenda', error);
  if (!data) throw new Error('El servidor no confirmó el registro del pago.');
  return String(data);
}

/**
 * Checks whether the 'status' column exists in the remote recurring_templates table.
 */
async function checkHasStatusColumn(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  if (_hasStatusColumn !== null) return _hasStatusColumn;
  try {
    const { error } = await supabase.from('recurring_templates').select('status').limit(1);
    _hasStatusColumn = !error;
  } catch {
    _hasStatusColumn = false;
  }
  return _hasStatusColumn;
}

/**
 * Creates a new recurring template in the database, validating all constraints
 * and returning the fully hydrated entity.
 */
export async function createRecurringTemplate(
  templateData: CreateRecurringTemplateDTO
): Promise<RecurringTemplate> {
  if (templateData.type === 'income') {
    throw new Error('La agenda actual admite compromisos de gasto. Registra ingresos desde Billetera.');
  }
  const title = templateData.title?.trim() || templateData.name?.trim();
  if (!title) {
    throw new Error('El título o nombre de la plantilla es obligatorio.');
  }

  const amount = Number(templateData.amount ?? templateData.expected_amount ?? 0);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('El monto de la plantilla debe ser un número positivo.');
  }

  const frequency = templateData.frequency || 'monthly';
  if (!['once', 'monthly', 'yearly'].includes(frequency)) {
    throw new Error(`Frecuencia inválida '${frequency}'. Debe ser 'once', 'monthly' o 'yearly'.`);
  }

  const status = templateData.status || 'pending';
  if (!['pending', 'paid', 'overdue'].includes(status)) {
    throw new Error(`Estado inválido '${status}'. Debe ser 'pending', 'paid' o 'overdue'.`);
  }

  if (status === 'paid') {
    throw new Error('Registra el pago de la ocurrencia con una cuenta; cambiar el estado no registra contabilidad.');
  }

  const paymentDay = templateData.payment_day ?? templateData.day_of_month ?? null;
  if (paymentDay !== null && (paymentDay < 1 || paymentDay > 31)) {
    throw new Error('El día de pago debe estar entre 1 y 31.');
  }

  let dueDateStr: string | null = null;
  if (templateData.due_date) {
    dueDateStr =
      templateData.due_date instanceof Date
        ? templateData.due_date.toISOString().split('T')[0]
        : String(templateData.due_date).split('T')[0];
  }

  if (USE_MOCKS) {
    const newTemplate: RecurringTemplate = {
      id: `rec-${Math.random().toString(36).substring(2, 9)}`,
      user_id: templateData.user_id || 'user-mock-1',
      title,
      name: title,
      amount,
      expected_amount: amount,
      frequency,
      status,
      due_date: dueDateStr,
      next_due_date: dueDateStr,
      payment_day: paymentDay,
      day_of_month: paymentDay ?? undefined,
      account_id: templateData.account_id || null,
      credit_card_id: templateData.credit_card_id || null,
      category_id: templateData.category_id || null,
      type: templateData.type || 'expense',
      is_essential: templateData.is_essential ?? false,
      is_active: templateData.is_active ?? true,
      lead_days: templateData.lead_days ?? 5,
      created_at: new Date().toISOString(),
    };
    recurringTemplatesDb.push(newTemplate);
    return newTemplate;
  }

  const supabase = createClient();
  let userId = templateData.user_id;

  if (!userId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Usuario no autenticado al intentar crear plantilla recurrente.');
    }
    userId = user.id;
  }

  const hasStatus = await checkHasStatusColumn(supabase);

  // Canonical columns strictly compatible with Supabase schema (both staging and migrated)
  const insertPayload: Record<string, any> = {
    user_id: userId,
    name: title,
    expected_amount: amount,
    frequency,
    is_essential: templateData.is_essential ?? false,
    is_active: templateData.is_active ?? true,
    account_id: templateData.account_id || null,
    credit_card_id: templateData.credit_card_id || null,
    category_id: templateData.category_id || null,
  };

  const resolvedDueDate = calculateNextDueDate({
    frequency,
    paymentDay,
    dueDate: dueDateStr,
  });

  insertPayload.next_due_date = resolvedDueDate;

  if (paymentDay !== null && paymentDay !== undefined) {
    insertPayload.day_of_month = paymentDay;
  }

  if (hasStatus && status) {
    insertPayload.status = status;
  }

  let insertedData: any = null;

  // Attempt insert with relational join first
  const { data, error } = await supabase
    .from('recurring_templates')
    .insert([insertPayload])
    .select(`
      *,
      account:accounts(*),
      credit_card:credit_cards(*),
      category:categories(*)
    `)
    .single();

  if (!error && data) {
    insertedData = data;
  } else {
    // Fallback without relational join if PostgREST cache has not updated
    const fallback = await supabase
      .from('recurring_templates')
      .insert([insertPayload])
      .select('*')
      .single();

    if (fallback.error) {
      throw new SupabaseRepositoryError('createRecurringTemplate', fallback.error);
    }
    insertedData = fallback.data;
  }

  const normalized = normalizeRecurringTemplate(insertedData);
  if (status) {
    normalized.status = status;
  }
  const [hydrated] = await hydrateRelationalEntities(supabase, [normalized]);
  return hydrated;
}

/**
 * Updates the status of a recurring template ('pending' | 'paid' | 'overdue').
 *
 * @param id - Template ID
 * @param status - Target status
 */
export async function updateRecurringTemplateStatus(
  id: string,
  status: 'pending' | 'paid' | 'overdue'
): Promise<RecurringTemplate> {
  if (status === 'paid') throw new Error('Usa Registrar pago para guardar el movimiento y el saldo.');
  if (!id) {
    throw new Error('El ID de la plantilla es requerido para actualizar el estado.');
  }

  if (!['pending', 'paid', 'overdue'].includes(status)) {
    throw new Error(`Estado inválido '${status}'. Debe ser 'pending', 'paid' o 'overdue'.`);
  }

  if (USE_MOCKS) {
    const idx = recurringTemplatesDb.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Plantilla recurrente con ID ${id} no encontrada.`);
    }
    recurringTemplatesDb[idx] = {
      ...recurringTemplatesDb[idx],
      status,
    };
    return recurringTemplatesDb[idx];
  }

  const supabase = createClient();
  const hasStatus = await checkHasStatusColumn(supabase);

  if (hasStatus) {
    const { data, error } = await supabase
      .from('recurring_templates')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new SupabaseRepositoryError('updateRecurringTemplateStatus', error);
    }

    const normalized = normalizeRecurringTemplate(data);
    normalized.status = status;
    const [hydrated] = await hydrateRelationalEntities(supabase, [normalized]);
    return hydrated;
  }

  throw new Error('La base de datos no permite guardar el estado. No se aplicó el cambio.');
}

/**
 * Deletes a recurring template by its identifier.
 *
 * @param id - Template ID
 */
export async function deleteRecurringTemplate(id: string): Promise<void> {
  if (id.startsWith('goal:')) throw new Error('Edita el plan desde la meta para actualizar sus compromisos.');
  if (!id) {
    throw new Error('El ID de la plantilla es requerido para eliminar.');
  }

  if (USE_MOCKS) {
    const idx = recurringTemplatesDb.findIndex((t) => t.id === id);
    if (idx !== -1) {
      recurringTemplatesDb.splice(idx, 1);
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('recurring_templates')
    .delete()
    .eq('id', id);

  if (error) {
    throw new SupabaseRepositoryError('deleteRecurringTemplate', error);
  }
}

/**
 * Retrieves a single recurring template by its ID.
 */
export async function getRecurringTemplateById(id: string): Promise<RecurringTemplate | null> {
  if (!id) return null;

  if (USE_MOCKS) {
    const found = recurringTemplatesDb.find((t) => t.id === id);
    return found || null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_templates')
    .select(`
      *,
      account:accounts(*),
      credit_card:credit_cards(*),
      category:categories(*)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    const fallback = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fallback.error || !fallback.data) {
      return null;
    }

    const normalized = normalizeRecurringTemplate(fallback.data);
    const [hydrated] = await hydrateRelationalEntities(supabase, [normalized]);
    return hydrated;
  }

  return normalizeRecurringTemplate(data);
}

/**
 * Updates arbitrary fields of a recurring template.
 */
export async function updateRecurringTemplate(
  id: string,
  updates: UpdateRecurringTemplateDTO
): Promise<RecurringTemplate> {
  if (id.startsWith('goal:')) throw new Error('Edita el plan desde la meta para actualizar sus compromisos.');
  if (updates.type === 'income') {
    throw new Error('La agenda actual admite compromisos de gasto. Registra ingresos desde Billetera.');
  }
  if (updates.status === 'paid') {
    throw new Error('El pago debe registrarse desde la agenda con una cuenta de pago.');
  }
  if (!id) {
    throw new Error('ID requerido para actualizar la plantilla.');
  }

  if (USE_MOCKS) {
    const idx = recurringTemplatesDb.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Plantilla no encontrada');
    recurringTemplatesDb[idx] = normalizeRecurringTemplate({
      ...recurringTemplatesDb[idx],
      ...updates,
    });
    return recurringTemplatesDb[idx];
  }

  const supabase = createClient();
  const hasStatus = await checkHasStatusColumn(supabase);

  // Canonical columns compatible with remote DB schema
  const dbUpdates: Record<string, any> = {};

  if (updates.title !== undefined || updates.name !== undefined) {
    dbUpdates.name = updates.title || updates.name;
  }

  if (updates.amount !== undefined || updates.expected_amount !== undefined) {
    dbUpdates.expected_amount = Number(updates.amount ?? updates.expected_amount);
  }

  if (updates.frequency !== undefined) {
    dbUpdates.frequency = updates.frequency;
  }

  if (updates.account_id !== undefined) {
    dbUpdates.account_id = updates.account_id || null;
  }

  if (updates.credit_card_id !== undefined) {
    dbUpdates.credit_card_id = updates.credit_card_id || null;
  }

  if (updates.category_id !== undefined) {
    dbUpdates.category_id = updates.category_id || null;
  }

  if (updates.payment_day !== undefined || updates.day_of_month !== undefined) {
    dbUpdates.day_of_month = updates.payment_day ?? updates.day_of_month ?? null;
  }

  if (updates.due_date !== undefined || updates.next_due_date !== undefined) {
    const d = updates.due_date ?? updates.next_due_date;
    const dueDateStr = d instanceof Date
      ? d.toISOString().split('T')[0]
      : d
      ? String(d).split('T')[0]
      : null;
    if (dueDateStr) {
      dbUpdates.next_due_date = dueDateStr;
    }
  } else if (updates.payment_day !== undefined || updates.day_of_month !== undefined) {
    const recalculated = calculateNextDueDate({
      frequency: updates.frequency,
      paymentDay: updates.payment_day ?? updates.day_of_month,
    });
    dbUpdates.next_due_date = recalculated;
  }

  if (updates.is_essential !== undefined) {
    dbUpdates.is_essential = updates.is_essential;
  }

  if (updates.is_active !== undefined) {
    dbUpdates.is_active = updates.is_active;
  }

  if (hasStatus && updates.status !== undefined) {
    dbUpdates.status = updates.status;
  }

  const { data, error } = await supabase
    .from('recurring_templates')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new SupabaseRepositoryError('updateRecurringTemplate', error);
  }

  const normalized = normalizeRecurringTemplate(data);
  if (updates.status) {
    normalized.status = updates.status;
  }
  const [hydrated] = await hydrateRelationalEntities(supabase, [normalized]);
  return hydrated;
}

