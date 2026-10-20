import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAccounts } from '@/features/wallet/hooks/useAccounts';
import { useCreditCards } from '@/features/credit-cards/hooks/useCreditCards';
import { useTransactions } from '@/features/wallet/hooks/useTransactions';
import { useCategories } from '@/features/budget/hooks/useCategories';
import { useBanks } from '@/features/wallet/hooks/useBanks';
import { useBillingStatements } from '@/features/credit-cards/hooks/useBillingStatements';
import { WalletDetailView } from './WalletDetailView';
import { WalletOverview } from '@/features/wallet/components/WalletOverview';
import { CreditCardsOverview } from '@/features/credit-cards/components/CreditCardsOverview';
import { AddInstrumentModal } from './components/AddInstrumentModal';
import { ViewHeader } from '@/shared/ui/ViewHeader';
import { Wallet, CreditCard } from 'lucide-react';

export function WalletView() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: accounts, isLoading: loadingAcc } = useAccounts();
  const { data: creditCards, isLoading: loadingCards } = useCreditCards();
  const transactionsQuery=useTransactions();
  const { data: allTransactions, isLoading: loadingTx } = transactionsQuery;
  const { data: categories, isLoading: loadingCat } = useCategories();
  const { data: banks, isLoading: loadingBanks } = useBanks();
  const { data: billingStatements, isLoading: loadingBilling } = useBillingStatements();

  // If an ID is present in the query string, delegate directly to unified WalletDetailView
  if (id) {
    return <WalletDetailView />;
  }

  const isLoading = loadingAcc || loadingCards || loadingTx || loadingCat || loadingBanks || loadingBilling;

  if(transactionsQuery.isError)return <div role="alert" className="p-8 text-center"><p>{transactionsQuery.error.message}</p><button type="button" onClick={()=>void transactionsQuery.refetch()} className="mt-3 rounded-xl bg-brand-primary px-4 py-2 text-white">Reintentar</button></div>;
  if (isLoading || !accounts || !creditCards || !allTransactions || !categories || !banks || !billingStatements) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full opacity-50 p-10 text-sm">
        Cargando billetera...
      </div>
    );
  }

  const transactions = allTransactions.filter(t => t.status !== 'pending');
  const creditCardTransactions = allTransactions.filter(t => t.credit_card_id);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 md:p-6 text-foreground animate-in fade-in duration-300 font-sans pb-24">
      {/* Vista 1 (Arriba): Billetera y Cuentas */}
      <div className="flex flex-col gap-6 w-full">
        <ViewHeader
          icon={<Wallet className="w-6 h-6" />}
          title="Billetera"
          description="Gestiona tu patrimonio, cuentas y analiza tus gastos."
        />
        <WalletOverview
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          banks={banks}
          onAddAccount={() => setIsAddModalOpen(true)}
        />
      </div>

      {/* Separador */}
      <hr className="border-border-subtle my-2" />

      {/* Vista 2 (Abajo): Tarjetas de Crédito */}
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center gap-2 px-1">
          <CreditCard size={20} className="text-[#6d28d9]" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Tarjetas de Crédito</h2>
            <p className="text-on-surface-card-secondary text-xs">Controla tus deudas, cupos y fechas de facturación.</p>
          </div>
        </div>
        <CreditCardsOverview
          creditCards={creditCards}
          banks={banks}
          transactions={creditCardTransactions}
          categories={categories}
          billingStatements={billingStatements}
          onAddCard={() => setIsAddModalOpen(true)}
        />
      </div>

      {/* Modal Unificado para Añadir Cuentas o Tarjetas */}
      <AddInstrumentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}

export default WalletView;


