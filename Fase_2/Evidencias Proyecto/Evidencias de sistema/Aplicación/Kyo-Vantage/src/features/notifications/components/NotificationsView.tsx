import React from 'react';
import { ShieldAlert, AlertTriangle, Bell, Plus, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { markAsRead, markAllAsRead, deleteNotification } from '@/features/notifications/api/notificationRepository';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

export function NotificationsView() {
  const { runMutation } = usePrivateMutation();
  const { data: notifications = [], isLoading } = useNotifications();

  const handleMarkAsRead = async (id: string) => {
    await runMutation(() => markAsRead(id));
  };

  const handleMarkAllAsRead = async () => {
    await runMutation(() => markAllAsRead());
  };

  const handleDelete = async (id: string) => {
    await runMutation(() => deleteNotification(id));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Hace un momento';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'security': return <ShieldAlert size={20} className="text-[#E24B4A]" />;
      case 'alert':
      case 'budget': return <AlertTriangle size={20} className="text-[#F5A623]" />;
      case 'creation': return <Plus size={20} className="text-[#3B6D11]" />;
      case 'success': return <CheckCircle2 size={20} className="text-[#3B6D11]" />;
      case 'transaction': return <RefreshCw size={20} className="text-kyo-lightPurple" />;
      case 'system':
      default: return <Bell size={20} className="text-default-400" />;
    }
  };

  const getBackgroundForType = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-white dark:bg-surface-card border-border-subtle';

    switch (type) {
      case 'security': return 'bg-danger-50 dark:bg-danger-900/10 border-danger-200 dark:border-danger-900/30';
      case 'alert':
      case 'budget': return 'bg-warning-50 dark:bg-warning-900/10 border-warning-200 dark:border-warning-900/30';
      case 'creation':
      case 'success': return 'bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-900/30';
      case 'transaction':
      case 'system':
      default: return 'bg-kyo-lightPurple/5 dark:bg-kyo-lightPurple/10 border-kyo-lightPurple/20';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-bold text-[#a0a0b8] uppercase tracking-widest">Historial de Actividad</h2>

        {notifications.some(n => !n.is_read) && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 text-[12px] font-bold text-kyo-lightPurple hover:bg-kyo-lightPurple/10 px-3 py-1.5 rounded-xl transition-colors"
          >
            <CheckCircle2 size={14} />
            Marcar todo como leído
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="animate-spin text-default-300" size={24} />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-surface-card rounded-3xl border border-border-subtle shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.4)]">
          <div className="w-16 h-16 bg-default-100 dark:bg-surface-raised rounded-full flex items-center justify-center mb-4">
            <Bell size={28} className="text-default-400" />
          </div>
          <h3 className="text-[16px] font-bold text-foreground mb-1">Todo al día</h3>
          <p className="text-[13px] text-default-500 max-w-[250px]">
            No tienes notificaciones ni actividad reciente en tu cuenta.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex gap-4 p-5 rounded-3xl border shadow-sm transition-all group ${getBackgroundForType(notif.type, notif.is_read)}`}
            >
              <div className="mt-1 flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm border border-border-subtle">
                  {getIconForType(notif.type)}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-w-0 justify-center">
                <div className="flex items-start justify-between gap-2">
                  <h4 className={`text-[15px] font-bold truncate ${notif.is_read ? 'text-foreground' : 'text-foreground'}`}>
                    {notif.title}
                  </h4>
                  <span className="text-[11px] font-bold text-[#a0a0b8] flex-shrink-0 whitespace-nowrap mt-1">
                    {formatTimestamp(notif.created_at)}
                  </span>
                </div>

                <p className="text-[13px] text-default-500 mt-1 leading-relaxed">
                  {notif.message}
                </p>

                <div className="flex items-center gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="px-3 h-7 text-[11px] font-bold bg-kyo-lightPurple/10 text-kyo-lightPurple rounded-full hover:bg-kyo-lightPurple/20 transition-colors"
                    >
                      Marcar como leída
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="flex items-center gap-1.5 px-3 h-7 text-[11px] font-bold text-[#f31260] hover:bg-[#f31260]/10 rounded-full transition-colors"
                  >
                    <Trash2 size={12} />
                    Eliminar
                  </button>
                </div>
              </div>

              {!notif.is_read && (
                <div className="flex-shrink-0 flex items-center pl-2">
                  <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
