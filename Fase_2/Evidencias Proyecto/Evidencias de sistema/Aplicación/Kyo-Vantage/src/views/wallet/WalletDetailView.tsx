import { Suspense, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { useBanks } from '@/features/wallet/hooks/useBanks';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { useBillingStatementsByCard } from '@/features/credit-cards/hooks/useBillingStatementsByCard';
import { AccountDetailView } from '@/features/wallet/components/account/AccountDetailView';
import { CreditCardDetailView } from '@/features/credit-cards/components/CreditCardDetailView';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Wallet, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@heroui/react';

function WalletDetailContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const id = searchParams.get('id');
  const typeParam = searchParams.get('type'); // 'account' | 'card' | 'credit-card' | null

  const accountsQuery = useAccounts();
  const creditCardsQuery = useCreditCards();
  const banksQuery = useBanks();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();

  const accounts = accountsQuery.data || [];
  const creditCards = creditCardsQuery.data || [];
  const banks = banksQuery.data || [];
  const allTransactions = transactionsQuery.data || [];
  const categories = categoriesQuery.data || [];

  // Determine instrument type and resolved target
  const { resolvedType, targetAccount, targetCard } = useMemo(() => {
    if (!id) {
      // Default to first account or first credit card if available
      if (accounts.length > 0) return { resolvedType: 'account' as const, targetAccount: accounts[0], targetCard: null };
      if (creditCards.length > 0) return { resolvedType: 'card' as const, targetAccount: null, targetCard: creditCards[0] };
      return { resolvedType: null, targetAccount: null, targetCard: null };
    }

    if (typeParam === 'card' || typeParam === 'credit-card') {
      const card = creditCards.find(c => c.id === id);
      return { resolvedType: 'card' as const, targetAccount: null, targetCard: card || null };
    }

    if (typeParam === 'account') {
      const acc = accounts.find(a => a.id === id);
      return { resolvedType: 'account' as const, targetAccount: acc || null, targetCard: null };
    }

    // Auto-detect if type param is not explicitly given
    const acc = accounts.find(a => a.id === id);
    if (acc) {
      return { resolvedType: 'account' as const, targetAccount: acc, targetCard: null };
    }

    const card = creditCards.find(c => c.id === id);
    if (card) {
      return { resolvedType: 'card' as const, targetAccount: null, targetCard: card };
    }

    return { resolvedType: null, targetAccount: null, targetCard: null };
  }, [id, typeParam, accounts, creditCards]);

  const activeCardId = resolvedType === 'card' && targetCard ? targetCard.id : null;
  const billingStatementsQuery = useBillingStatementsByCard(activeCardId);

  const isLoading =
    accountsQuery.isLoading ||
    creditCardsQuery.isLoading ||
    banksQuery.isLoading ||
    transactionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    (resolvedType === 'card' && billingStatementsQuery.isLoading);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/20 border border-[#6d28d9]/40 flex items-center justify-center text-[#8b5cf6]">
          <Wallet className="w-6 h-6 animate-bounce" />
        </div>
        <p className="text-gray-400 text-sm font-medium">Cargando detalle del instrumento...</p>
      </div>
    );
  }

  // Not found state
  if (!targetAccount && !targetCard) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto min-h-[360px] gap-4">
        <div className="w-16 h-16 rounded-3xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
          <AlertCircle size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Instrumento no encontrado</h2>
          <p className="text-gray-400 text-xs">
            {id
              ? `No se encontró ninguna cuenta o tarjeta con el ID "${id}".`
              : 'No se especificó ningún instrumento y tu billetera no registra cuentas ni tarjetas activas.'}
          </p>
        </div>
        <Button
          className="bg-brand-primary hover:bg-[#5b21b6] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-[#6d28d9]/30"
          onPress={() => navigate('/wallet')}
        >
          <ArrowLeft size={16} /> Volver a la Billetera
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto p-4 md:p-6 text-white animate-in fade-in">
      {/* Renderizado del Detalle Correspondiente */}
      {resolvedType === 'account' && targetAccount && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col w-full">
            <PageHeader title={targetAccount.name} description="Detalle de cuenta bancaria y movimientos" showBack backUrl="/wallet" />
          </div>

          <AccountDetailView
            account={targetAccount}
            transactions={allTransactions.filter(
              (item) => item.account_id === targetAccount.id && item.status !== 'pending'
            )}
            categories={categories}
            bank={banks.find((b) => b.id === targetAccount.bank_id)}
            banks={banks}
          />
        </div>
      )}

      {resolvedType === 'card' && targetCard && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col w-full">
            <PageHeader title={targetCard.name} description="Detalle de tarjeta de crédito, cupos y vencimientos" showBack backUrl="/wallet" />
          </div>

          <CreditCardDetailView
            card={targetCard}
            bank={banks.find((b) => b.id === targetCard.bank_id)}
            banks={banks}
            transactions={allTransactions.filter(
              (item) => item.credit_card_id === targetCard.id
            )}
            categories={categories}
            billingStatements={billingStatementsQuery.data || []}
          />
        </div>
      )}
    </div>
  );
}

export function WalletDetailView() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[300px] w-full opacity-50 p-10 text-sm text-gray-400">
          Cargando detalle...
        </div>
      }
    >
      <WalletDetailContent />
    </Suspense>
  );
}

export default WalletDetailView;
