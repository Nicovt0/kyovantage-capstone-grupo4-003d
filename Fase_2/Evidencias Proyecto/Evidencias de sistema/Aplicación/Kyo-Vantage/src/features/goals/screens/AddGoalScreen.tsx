import { PageHeader } from "@/shared/ui/PageHeader";
import { GoalForm } from "@/features/goals/components/form/GoalForm";
export default function AddGoalPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col w-full">
        <PageHeader title="Añadir Meta" showBack backUrl="/goals" />
      </div>

      <GoalForm />
    </div>
  );
}
