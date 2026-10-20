import { PageHeader } from "@/shared/ui/PageHeader";
import { NotificationsView } from "@/features/notifications/components/NotificationsView";

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-3xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Notificaciones"
          description="Historial de alertas, recordatorios y eventos de tu cuenta."
        />
      </div>

      <NotificationsView />
    </div>
  );
}
