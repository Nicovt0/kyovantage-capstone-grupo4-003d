import { FixedItemsManagerV3 } from "@/features/settings/components/FixedItemsManagerV3";

export default function FixedExpensesPage() {
  return (
    <FixedItemsManagerV3
      type="expense"
      title="Gastos Fijos"
      subtitle="Configura tus gastos fijos obligatorios, como luz, agua o arriendo."
    />
  );
}
