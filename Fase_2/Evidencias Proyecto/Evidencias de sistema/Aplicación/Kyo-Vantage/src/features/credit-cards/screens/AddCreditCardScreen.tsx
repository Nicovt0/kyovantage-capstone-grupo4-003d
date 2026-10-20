import { CreditCardForm } from "@/features/credit-cards/components/CreditCardForm";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useBanks } from '@/features/wallet/hooks/useBanks';

export default function CreditCardFormPage() {
  const { data: banks = [], isLoading } = useBanks();

  if (isLoading) return <div className="p-8 text-center opacity-50 text-sm">Cargando bancos...</div>;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Añadir Tarjeta de Crédito"
          description="Agrega tu tarjeta y mantén el control de tus fechas y deudas"
          showBack={true}
          backUrl="/credit-cards"
        />
      </div>

      <CreditCardForm banks={banks} />
    </div>
  );
}
