import { PageHeader } from "@/shared/ui/PageHeader";
import { AccountForm } from "@/features/wallet/components/account/AccountForm";
import { useBanks } from '@/features/wallet/hooks/useBanks';

export default function AddAccountPage() {
  const { data: banks = [], isLoading } = useBanks();

  if (isLoading) return <div className="p-8 text-center opacity-50 text-sm">Cargando bancos...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Añadir Cuenta"
          description="Registra una nueva cuenta bancaria."
          showBack
        />
      </div>

      <AccountForm banks={banks} />
    </div>
  );
}
