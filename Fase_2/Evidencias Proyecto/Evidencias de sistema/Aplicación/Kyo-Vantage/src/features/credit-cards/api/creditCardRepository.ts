import { accountingMutation } from '@/features/accounting/api/accountingRepository';
import { CreditCard, CreditCardInput, CreditCardTemplate } from "@/types";
import { creditCardsDb } from '@/mockdata/creditCards';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";
import { createNotification } from "@/features/notifications/api/notificationRepository";
import {
  findCreditCardTemplate,
  getCreditCardTemplatesByIds,
  templateConfigurationError,
  toDatabaseCurrency,
  toUiCurrency,
} from '@/features/wallet/api/bankTemplateRepository';

interface RawCreditCardRow {
  id: string;
  user_id?: string;
  template_id?: string | null;
  bank_id?: string;
  name: string;
  card_network?: CreditCard['issuer'] | null;
  issuer?: CreditCard['issuer'] | null;
  type?: string | null;
  total_limit?: number | null;
  recommended_threshold?: number | null;
  billing_date?: number | null;
  payment_date?: number | null;
  maintenance_cost?: number | null;
  maintenance_currency?: string | null;
  monthly_interest_rate?: number | null;
  default_interest_rate?: number | null;
  penalty_interest_rate?: number | null;
  last_4_digits?: string | number | null;
  current_debt?: number | null;
  is_archived?: boolean | null;
  [key: string]: unknown;
}

const normalizeCreditCard = (row: RawCreditCardRow, template?: CreditCardTemplate): CreditCard => ({
  ...row,
  template_id: row.template_id ?? null,
  // Compatibility aliases for the current UI. These are derived from the
  // staging template and are never sent back as database columns.
  bank_id: template?.bank_id ?? row.bank_id,
  type: template?.name ?? row.type ?? 'Classic',
  issuer: row.card_network ?? row.issuer ?? template?.card_network ?? 'other',
  card_network: row.card_network ?? template?.card_network ?? 'other',
  total_limit: row.total_limit ?? 0,
  current_debt: row.current_debt ?? 0,
  billing_date: row.billing_date ?? 1,
  payment_date: row.payment_date ?? 1,
  maintenance_cost: row.maintenance_cost ?? template?.default_maintenance_cost ?? 0,
  monthly_interest_rate: row.monthly_interest_rate ?? template?.default_monthly_interest_rate ?? 0,
  recommended_threshold: row.recommended_threshold ?? 30,
  default_interest_rate: row.penalty_interest_rate ?? row.default_interest_rate ?? template?.default_penalty_interest_rate ?? 0,
  penalty_interest_rate: row.penalty_interest_rate ?? row.default_interest_rate ?? template?.default_penalty_interest_rate ?? 0,
  maintenance_currency: toUiCurrency(row.maintenance_currency ?? template?.maintenance_currency ?? undefined),
  last_4_digits: row.last_4_digits ?? undefined,
  is_archived: row.is_archived ?? false,
});

const hydrateCreditCards = async (rows: RawCreditCardRow[]): Promise<CreditCard[]> => {
  const templateIds = rows
    .map(row => row.template_id)
    .filter((id): id is string => Boolean(id));

  let templates = new Map<string, CreditCardTemplate>();
  try {
    templates = await getCreditCardTemplatesByIds(templateIds);
  } catch (error) {
    console.error('Error fetching credit card templates:', error);
  }

  return rows.map(row => normalizeCreditCard(row, templates.get(row.template_id || '')));
};

const resolveCreditCardTemplate = async (card: CreditCardInput) => {
  const template = await findCreditCardTemplate({
    templateId: card.template_id,
    bankId: card.bank_id,
    name: card.type,
    cardNetwork: card.issuer,
  });

  if (!template) throw templateConfigurationError('tarjetas');
  return template;
};

export const getCreditCards = async (): Promise<CreditCard[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(creditCardsDb.filter(card => !(card as CreditCard).is_archived)), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase.from('credit_cards').select('*').or('is_archived.is.null,is_archived.eq.false');
  if (error) {
    console.error('Error fetching credit cards:', error);
    return [];
  }
  return hydrateCreditCards(data || []);
};

export const addCreditCard = async (card: CreditCardInput): Promise<CreditCard> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newCard: CreditCard = {
          ...card,
          id: `cc-${Math.random().toString(36).substr(2, 9)}`,
          bank_id: card.bank_id || '',
          recommended_threshold: card.recommended_threshold ?? 30,
          maintenance_cost: card.maintenance_cost ?? 0,
          monthly_interest_rate: card.monthly_interest_rate ?? 0,
        };
        creditCardsDb.push(newCard as typeof creditCardsDb[number]);
        resolve(newCard);
      }, 100);
    });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  // Límite de 10 tarjetas para la versión Beta
  const { count } = await supabase
    .from('credit_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count !== null && count >= 5) {
    throw new Error('Límite de la versión Beta: No puedes crear más de 5 tarjetas de crédito.');
  }

  const template = await resolveCreditCardTemplate(card);
  const maintenanceCurrency = toDatabaseCurrency(card.maintenance_currency || template.maintenance_currency || undefined);
  const cardData = {
    template_id: template.id,
    name: card.name,
    card_network: card.issuer,
    total_limit: card.total_limit,
    current_debt: card.current_debt ?? 0,
    billing_date: card.billing_date,
    payment_date: card.payment_date,
    maintenance_cost: card.maintenance_cost ?? template.default_maintenance_cost ?? 0,
    maintenance_currency: maintenanceCurrency,
    monthly_interest_rate: card.monthly_interest_rate ?? template.default_monthly_interest_rate ?? 0,
    penalty_interest_rate: card.penalty_interest_rate ?? card.default_interest_rate ?? template.default_penalty_interest_rate ?? 0,
    last_4_digits: card.last_4_digits === undefined || card.last_4_digits === '' ? null : String(card.last_4_digits),
    is_archived: card.is_archived ?? false,
  };

  const { data, error } = await supabase
    .from('credit_cards')
    .insert([{ ...cardData, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'creation',
    title: 'Tarjeta Creada',
    message: `Has añadido la tarjeta de crédito "${card.name}".`
  });

  return normalizeCreditCard(data, template);
};

export const updateCreditCard = async (id: string, updates: Partial<CreditCard>): Promise<CreditCard> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = creditCardsDb.findIndex(c => c.id === id);
        if (idx === -1) return reject(new Error('Credit card not found'));
        const updatedCard = { ...creditCardsDb[idx], ...updates } as CreditCard;
        creditCardsDb[idx] = updatedCard as typeof creditCardsDb[number];
        resolve(updatedCard);
      }, 100);
    });
  }

  const supabase = createClient();
  const dbUpdates: Record<string, unknown> = {};
  const source = updates as Record<string, unknown>;
  const supportedFields = [
    'name', 'total_limit', 'current_debt', 'billing_date', 'payment_date',
    'maintenance_cost', 'monthly_interest_rate', 'is_archived', 'last_4_digits',
  ];

  for (const field of supportedFields) {
    if (field in source) dbUpdates[field] = source[field];
  }

  if ('maintenance_currency' in source) {
    dbUpdates.maintenance_currency = toDatabaseCurrency(
      typeof source.maintenance_currency === 'string' ? source.maintenance_currency : undefined,
    );
  }

  if ('penalty_interest_rate' in source || 'default_interest_rate' in source) {
    dbUpdates.penalty_interest_rate = source.penalty_interest_rate ?? source.default_interest_rate ?? 0;
  }

  if ('issuer' in source) dbUpdates.card_network = source.issuer;

  if ('template_id' in source || 'bank_id' in source) {
    const current = await supabase
      .from('credit_cards')
      .select('template_id, card_network')
      .eq('id', id)
      .single();

    if ('template_id' in source) {
      const template = await findCreditCardTemplate({
        templateId: typeof source.template_id === 'string' ? source.template_id : null,
      });
      if (source.template_id && !template) throw templateConfigurationError('tarjetas');
      dbUpdates.template_id = template?.id ?? null;
      if (template && !('issuer' in source)) dbUpdates.card_network = template.card_network;
    } else if (source.bank_id) {
      const currentTemplate = current.data?.template_id
        ? await findCreditCardTemplate({ templateId: current.data.template_id })
        : null;
      const template = await findCreditCardTemplate({
        bankId: String(source.bank_id),
        name: typeof source.type === 'string' ? source.type : currentTemplate?.name,
        cardNetwork: typeof source.issuer === 'string' ? source.issuer : current.data?.card_network,
      });
      if (!template) throw templateConfigurationError('tarjetas');
      dbUpdates.template_id = template.id;
      if (!('issuer' in source)) dbUpdates.card_network = template.card_network;
    }
  }

  if (Object.keys(dbUpdates).length === 0) {
    throw new Error('No hay cambios compatibles con el esquema de staging.');
  }

  const { data, error } = await supabase
    .from('credit_cards')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (updates.name || updates.total_limit || updates.billing_date) {
    await createNotification({
      type: 'system',
      title: 'Tarjeta Actualizada',
      message: `Se ha modificado la tarjeta de crédito "${updates.name || 'seleccionada'}".`
    });
  }

  const [card] = await hydrateCreditCards([data]);
  return card;
};

export const deleteCreditCard = async (id: string): Promise<void> => {
  if (USE_MOCKS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = creditCardsDb.findIndex(c => c.id === id);
        if (idx === -1) return reject(new Error('Credit card not found'));
        creditCardsDb.splice(idx, 1);
        resolve();
      }, 100);
    });
  }

  await accountingMutation('archive_card', { id });

  await createNotification({
    type: 'system',
    title: 'Tarjeta Archivada',
    message: `Has archivado una tarjeta de crédito conservando su historial.`
  });
};

export interface PaymentPayload {
  userId: string;
  cardId: string;
  sourceAccountId: string; // Cuenta de la Wallet desde donde paga
  amountPaid: number;      // Monto total pagado
  billingStatementId: string;
  customName?: string;     // Nombre personalizado para la transacción
  paymentDate?: string;    // Fecha de pago personalizada
  requestId?: string;
}

export const processCardPayment = async (payload: PaymentPayload): Promise<{ success: boolean; error?: string; nuevoCupoUtilizado?: number }> => {
  try {
    const result = await accountingMutation<{ current_debt: number }>('pay_statement', {
      statement_id: payload.billingStatementId,
      card_id: payload.cardId,
      account_id: payload.sourceAccountId,
      amount: payload.amountPaid,
      name: payload.customName,
      date: payload.paymentDate,
    }, payload.requestId);
    try {
      await createNotification({ type: 'success', title: 'Pago Registrado', message: `Se ha registrado un pago de tarjeta por $${payload.amountPaid.toLocaleString('es-CL')}.` });
    } catch (error) { console.error('Pago confirmado; no se pudo crear su notificación.', error); }
    return { success: true, nuevoCupoUtilizado: Number(result.current_debt) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const addCreditCardPurchase = async (purchase: {
  credit_card_id: string;
  category_id: string;
  name: string;
  amount_total: number;
  installment_total: number;
  installment_current: number;
  amount_per_installment: number;
  purchase_date: string;
  status: 'active' | 'paid' | 'refinanced';
}, requestId?: string) => {
  return accountingMutation<import('@/types').CreditCardLedger>('create_purchase', purchase, requestId);
};

export const getCreditCardLedger = async (cardId: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('credit_card_ledger')
    .select('*')
    .eq('credit_card_id', cardId)
    .order('purchase_date', { ascending: false });

  if (error) {
    console.error('Error fetching ledger:', error);
    return [];
  }
  return data;
};
