import React, { useState } from 'react';
import { Bell, Check, Loader2, X } from 'lucide-react';
import { Button } from '@heroui/react';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Contextual card for the Agenda view prompting the user to activate push alerts for due dates.
 */
export function AgendaPushNotificationBanner() {
  const { isSupported, isSubscribed, permissionState, isLoading, subscribe, error } = usePushNotifications();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('dismiss_agenda_push_banner') === 'true';
    }
    return false;
  });

  if (!isSupported || isSubscribed || dismissed || permissionState === 'denied') {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('dismiss_agenda_push_banner', 'true');
  };

  const handleActivate = async () => {
    await subscribe();
  };

  return (
    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-[#6d28d9]/15 via-[#6d28d9]/5 to-transparent border border-[#6d28d9]/25 shadow-lg backdrop-blur-md mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#6d28d9]/20 text-[#a78bfa] flex items-center justify-center shrink-0 border border-[#6d28d9]/30">
          <Bell size={20} className="animate-bounce" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-foreground">
            Prueba las notificaciones push
          </span>
          <span className="text-xs text-[#a0a0b8]">
            Activa la suscripción y envía una prueba desde Ajustes. Los recordatorios de Agenda se habilitarán más adelante.
          </span>
          {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <Button
          size="sm"
          onPress={handleActivate}
          isLoading={isLoading}
          className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-bold text-xs rounded-xl shadow-md shadow-[#6d28d9]/30 h-8 px-4"
        >
          {isLoading ? (
            'Activando...'
          ) : (
            <>
              <Check size={14} className="mr-1" />
              Activar notificaciones
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-default-400 hover:text-foreground hover:bg-default-100 dark:hover:bg-[#1f1e38] transition-colors"
          title="Descartar aviso"
          aria-label="Cerrar sugerencia de notificaciones"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default AgendaPushNotificationBanner;
