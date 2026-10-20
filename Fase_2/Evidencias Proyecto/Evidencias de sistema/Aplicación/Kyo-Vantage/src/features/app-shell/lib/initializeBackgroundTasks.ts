let initPromise: Promise<void> | null = null;
let initialized = false;

export function initializeBackgroundGenerators(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { checkAndGenerateRecurringTransactions } = await import('@/features/settings/api/recurringRepository');
      const { checkAndGenerateBillingStatements } = await import('@/features/credit-cards/api/billingRepository');

      await checkAndGenerateRecurringTransactions();
      await checkAndGenerateBillingStatements();
      initialized = true;
    } catch (err) {
      console.error('Error en generadores de fondo:', err);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}
