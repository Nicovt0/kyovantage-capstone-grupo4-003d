import { Suspense } from "react";
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from "@/shared/ui/PageHeader";
import { CreditCardDetailView } from "@/features/credit-cards/components/CreditCardDetailView";
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { useBillingStatementsByCard } from '@/features/credit-cards/hooks/useBillingStatementsByCard';
import { useBanks } from '@/features/wallet/hooks/useBanks';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useCategories } from '@/features/budget/hooks/useCategories';

function CreditCardDetailContent() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const creditCardsQuery = useCreditCards();
  const banksQuery = useBanks();
  const transactionsQuery = useTransactions();
  const categoriesQuery = useCategories();
  const billingStatementsQuery = useBillingStatementsByCard(id);
  const loading = creditCardsQuery.isLoading
    || banksQuery.isLoading
    || transactionsQuery.isLoading
    || categoriesQuery.isLoading
    || billingStatementsQuery.isLoading;
  const card = (creditCardsQuery.data || []).find(item => item.id === id);
  const banks = banksQuery.data || [];
  const bank = banks.find(item => item.id === card?.bank_id);
  const cardTransactions = (transactionsQuery.data || []).filter(item => item.credit_card_id === id);

  if (!id) return <div className="p-8 text-center text-danger">ID de tarjeta no válido.</div>;
  if (loading) return <div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando tarjeta...</div>;

  if (!card) {
    return <div className="p-8 text-center text-danger font-bold text-lg mt-20">Tarjeta no encontrada.</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader title={card.name} showBack />
      </div>

      <CreditCardDetailView
        card={card}
        bank={bank}
        banks={banks}
        transactions={cardTransactions}
        categories={categoriesQuery.data || []}
        billingStatements={billingStatementsQuery.data || []}
      />
    </div>
  );
}

export default function CreditCardDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center opacity-50 mt-20 text-sm">Cargando...</div>}>
      <CreditCardDetailContent />
    </Suspense>
  );
}
