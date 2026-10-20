import { useCreditCards } from "@/features/credit-cards/hooks/useCreditCards";
import { useBanks } from "@/features/wallet/hooks/useBanks";
import { useTransactions } from "@/features/wallet/hooks/useTransactions";
import { useCategories } from "@/features/budget/hooks/useCategories";
import { useBillingStatements } from "@/features/credit-cards/hooks/useBillingStatements";
import { PageHeader } from "@/shared/ui/PageHeader";
import { CreditCardsOverview } from "@/features/credit-cards/components/CreditCardsOverview";

export default function V3CreditCards() {
  const { data: creditCards, isLoading: loadingCards } = useCreditCards();
  const { data: banks, isLoading: loadingBanks } = useBanks();
  const { data: allTransactions, isLoading: loadingTx } = useTransactions();
  const { data: categories, isLoading: loadingCat } = useCategories();
  const { data: billingStatements, isLoading: loadingBilling } = useBillingStatements();

  const isLoading = loadingCards || loadingBanks || loadingTx || loadingCat || loadingBilling;

  if (isLoading || !creditCards || !banks || !allTransactions || !categories || !billingStatements) {
    return <div className="flex items-center justify-center h-full w-full opacity-50 p-10 text-sm">Cargando tarjetas...</div>;
  }

  const creditCardTransactions = allTransactions.filter(t => t.credit_card_id);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Tarjetas de Crédito"
          description="Controla tus deudas, cupos y fechas de facturación."
        />
      </div>

      <CreditCardsOverview
        creditCards={creditCards}
        banks={banks}
        transactions={creditCardTransactions}
        categories={categories}
        billingStatements={billingStatements}
      />
    </div>
  );
}
