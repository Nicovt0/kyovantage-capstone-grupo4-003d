import { accountingMutation } from '@/features/accounting/api/accountingRepository';
/**
 * Motor de Facturación y Cierre de Tarjetas de Crédito
 *
 * Enfoque A (Client-side): Se ejecuta al inicializar la app.
 * Verifica si hoy >= día de corte y genera el estado de cuenta si no existe.
 *
 * Fórmula:
 * Pago Pendiente = Consumos + Cuotas del Mes + Mantención + (Interés × Saldo Refinanciado)
 * Pago Mínimo   = (Consumos × 5%) + Cuotas + Mantención + Interés
 */

import { BillingStatement, CreditCard } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { getUFValue } from "@/features/credit-cards/api/ufRepository";

interface RawBillingStatement {
  id: string;
  user_id?: string;
  credit_card_id: string;
  billing_period: string;
  billing_date: string;
  payment_due_date: string;
  consumed_amount?: number | null;
  installment_amount?: number | null;
  maintenance_cost?: number | null;
  maintenance_in_uf?: boolean | null;
  uf_value_used?: number | null;
  total_due?: number | null;
  minimum_payment?: number | null;
  amount_paid?: number | null;
  status?: 'pending' | 'partial' | 'paid' | null;
  created_at?: string;
  [key: string]: unknown;
}

const normalizeBillingStatement = (row: RawBillingStatement): BillingStatement => ({
  ...row,
  consumed_amount: row.consumed_amount ?? 0,
  installment_amount: row.installment_amount ?? 0,
  maintenance_cost: row.maintenance_cost ?? 0,
  refinanced_balance: typeof row.refinanced_balance === 'number' ? row.refinanced_balance : 0,
  interest_amount: typeof row.interest_amount === 'number' ? row.interest_amount : 0,
  total_due: row.total_due ?? 0,
  minimum_payment: row.minimum_payment ?? 0,
  maintenance_in_uf: row.maintenance_in_uf ?? false,
  uf_value_used: row.uf_value_used ?? undefined,
  amount_paid: row.amount_paid ?? 0,
  status: (row.amount_paid ?? 0) > 0 && (row.amount_paid ?? 0) < (row.total_due ?? 0) ? 'partial' : row.status ?? 'pending',
});

// ─── Singleton lock para evitar ejecución concurrente ───
let billingPromise: Promise<void> | null = null;
const billingLocks = new Set<string>();

/**
 * Punto de entrada principal. Se llama desde dashboard/page.tsx
 * Verifica y genera estados de cuenta para TODAS las tarjetas del usuario.
 */
export async function checkAndGenerateBillingStatements(): Promise<void> {
  if (billingPromise) return billingPromise;

  billingPromise = (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      // Obtener todas las tarjetas del usuario
      const { data: cards, error: cardsError } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id);

      if (cardsError || !cards || cards.length === 0) return;

      // Obtener todos los billing_statements existentes para este período
      const { data: existingStatements } = await supabase
        .from('billing_statements')
        .select('credit_card_id, billing_period')
        .eq('user_id', user.id)
        .eq('billing_period', currentPeriod);

      const existingCardIds = new Set(
        (existingStatements || []).map((s: { credit_card_id: string }) => s.credit_card_id)
      );

      for (const card of cards as CreditCard[]) {
        // ¿Ya se generó este mes?
        if (existingCardIds.has(card.id)) continue;

        // ¿Hoy >= día de corte?
        const todayDay = now.getDate();
        if (todayDay < card.billing_date) continue;

        // Lock solo en memoria: la información financiera no se persiste en el dispositivo.
        const lockKey = `billing_gen_${currentPeriod}_${card.id}`;
        if (billingLocks.has(lockKey)) continue;
        billingLocks.add(lockKey);

        try {
          await generateBillingStatement(card, user.id, currentPeriod, now);
        } catch (err) {
          console.error(`Error generando statement para tarjeta ${card.id}:`, err);
          billingLocks.delete(lockKey);
        }
      }
    } finally {
      billingPromise = null;
    }
  })();

  return billingPromise;
}

/**
 * Genera el estado de cuenta para UNA tarjeta específica.
 */
async function generateBillingStatement(
  card: CreditCard,
  userId: string,
  currentPeriod: string,
  now: Date
): Promise<void> {
  const supabase = createClient();

  const billingYear = now.getFullYear();
  const billingMonth = now.getMonth(); // 0-indexed

  // El periodo inicia el día siguiente al corte del mes anterior, a las 00:00:00
  const periodStart = new Date(billingYear, billingMonth - 1, card.billing_date + 1, 0, 0, 0);
  // El periodo termina el día de corte de este mes, a las 23:59:59
  const periodEnd = new Date(billingYear, billingMonth, card.billing_date, 23, 59, 59, 999);

  // ── 2. Obtener transacciones del período ──
  const { data: ledgerEntries } = await supabase
    .from('credit_card_ledger')
    .select('*')
    .eq('credit_card_id', card.id)
    .eq('status', 'active');

  const activePurchases = (ledgerEntries || []);

  // ── 3. Separar consumos directos vs cuotas ──
  let consumedAmount = 0;
  let installmentAmount = 0;

  for (const purchase of activePurchases) {
    // Only count purchases that fall within the billing period for 1 installment,
    // or active installments.
    const remainingPrincipal = Number(purchase.remaining_principal ?? purchase.amount_total);
    if (remainingPrincipal <= 0) continue;
    if (purchase.installment_total > 1) {
      // Transacción en cuotas
      installmentAmount += purchase.installment_current >= purchase.installment_total
        ? remainingPrincipal : Math.min(purchase.amount_per_installment, remainingPrincipal);
    } else {
      // Compra directa (sin cuotas). Verificar fecha.
      const purchaseDate = new Date(purchase.purchase_date);
      if (purchaseDate >= periodStart && purchaseDate <= periodEnd) {
        consumedAmount += remainingPrincipal;
      }
    }
  }

  // ── 4. Costo de mantención ──
  let maintenanceCostCLP = card.maintenance_cost;
  let maintenanceInUF = false;
  let ufValueUsed: number | undefined;

  if (card.maintenance_currency?.toLowerCase() === 'uf') {
    maintenanceInUF = true;
    try {
      ufValueUsed = await getUFValue();
      maintenanceCostCLP = Math.round(card.maintenance_cost * ufValueUsed);
    } catch {
      // Si no se pudo obtener la UF, usar 0 para mantención y loguear
      console.error('No se pudo convertir mantención UF a CLP, usando 0');
      maintenanceCostCLP = 0;
    }
  }

  // ── 5. Interés sobre saldo refinanciado ──
  // El interés ahora se calcula diariamente a través del Cron Job de Intereses (daily-interest).
  // Por lo tanto, el nuevo estado de cuenta nace con 0 de interés acumulado.
  const interestAmount = 0;

  // ── 6. Totales ──
  const totalDue = consumedAmount + installmentAmount + maintenanceCostCLP + interestAmount;
  const minimumPayment = Math.round(consumedAmount * 0.05) + installmentAmount + maintenanceCostCLP + interestAmount;

  // ── 7. Fecha límite de pago ──
  // Si el día de pago es mayor al de corte (ej: corte 6, pago 11), cae en el mismo mes.
  // Si el día de pago es menor o igual al de corte (ej: corte 25, pago 5), cae al mes siguiente.
  let paymentDueMonth = billingMonth;
  let paymentDueYear = billingYear;

  if (card.payment_date <= card.billing_date) {
    paymentDueMonth = billingMonth + 1;
    if (paymentDueMonth > 11) {
      paymentDueMonth = 0;
      paymentDueYear++;
    }
  }

  const lastDayPaymentMonth = new Date(paymentDueYear, paymentDueMonth + 1, 0).getDate();
  const actualPaymentDay = Math.min(card.payment_date, lastDayPaymentMonth);
  const paymentDueDate = new Date(paymentDueYear, paymentDueMonth, actualPaymentDay);

  // ── 8. Insertar billing_statement ──
  // Solo enviamos columnas que existen en billing_statements de staging.
  // refinanced_balance e interest_amount se exponen como valores derivados
  // al leer, pero no se persisten porque esas columnas no existen allí.
  const statement = {
    user_id: userId,
    credit_card_id: card.id,
    billing_period: currentPeriod,
    billing_date: periodEnd.toISOString(),
    payment_due_date: paymentDueDate.toISOString(),
    consumed_amount: consumedAmount,
    installment_amount: installmentAmount,
    maintenance_cost: maintenanceCostCLP,
    total_due: totalDue,
    minimum_payment: minimumPayment,
    maintenance_in_uf: maintenanceInUF,
    uf_value_used: ufValueUsed,
    amount_paid: 0,
    status: totalDue <= 0 ? 'paid' : 'pending',
  };

  const { error } = await supabase
    .from('billing_statements')
    .insert([statement]);

  if (error?.code === '23505') return; // Another session already generated this card/period.
  if (error) {
    console.error('Error insertando billing_statement:', error);
    throw error;
  }
}
// ─── Consultas ───

/**
 * Obtiene todos los billing_statements pendientes o parciales del usuario.
 * Usado por la Agenda Financiera (PendingWidget).
 */
export async function getPendingBillingStatements(): Promise<BillingStatement[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('billing_statements')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending', 'partial'])
    .order('payment_due_date', { ascending: true });

  if (error) {
    console.error('Error obteniendo billing statements pendientes:', error);
    return [];
  }
  return (data || []).map((row: RawBillingStatement) => normalizeBillingStatement(row));
}

/**
 * Obtiene los billing_statements de una tarjeta específica.
 */
export async function getBillingStatementsByCard(creditCardId: string): Promise<BillingStatement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('billing_statements')
    .select('*')
    .eq('credit_card_id', creditCardId)
    .order('billing_period', { ascending: false });

  if (error) return [];
  return (data || []).map((row: RawBillingStatement) => normalizeBillingStatement(row));
}

/**
 * Registra un pago al estado de cuenta.
 * Actualiza amount_paid, status, current_debt de la tarjeta, y balance de la cuenta.
 * Los datos de pago persistidos en staging son amount_paid y status.
 */
export async function payBillingStatement(
  statementId: string,
  amount: number,
  accountId: string
): Promise<void> {
  await accountingMutation('pay_statement', { statement_id: statementId, amount, account_id: accountId });
}
