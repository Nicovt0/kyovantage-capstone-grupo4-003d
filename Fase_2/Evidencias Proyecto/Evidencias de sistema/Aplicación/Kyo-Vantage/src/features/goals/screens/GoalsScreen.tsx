import { useGoals } from "@/features/goals/hooks/useGoals";
import { GoalsDashboardView } from "@/features/goals/components/dashboard/GoalsDashboardView";
import { PageHeader } from "@/shared/ui/PageHeader";

export default function V3Goals() {
  const { data: goals, isLoading } = useGoals();

  if (isLoading || !goals) {
    return <div className="flex items-center justify-center h-full w-full opacity-50 p-10 text-sm">Cargando metas...</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Metas de Ahorro"
          description="Haz seguimiento a tus objetivos financieros y sueños"
        />
      </div>

      <GoalsDashboardView goals={goals} />
    </div>
  );
}
