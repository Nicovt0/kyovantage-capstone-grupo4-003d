import { PageHeader } from "@/shared/ui/PageHeader";
import { BudgetForm } from "@/features/budget/components/BudgetForm";
import { useCategories } from '@/features/budget/hooks/useCategories';

export default function AddBudgetPage() {
  const { data: categories = [], isLoading } = useCategories();

  if (isLoading) return <div className="p-8 text-center opacity-50 text-sm">Cargando categorías...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Añadir Presupuesto"
          description="Configura un nuevo límite mensual"
          showBack={true}
        />
      </div>

      <BudgetForm categories={categories} />
    </div>
  );
}
