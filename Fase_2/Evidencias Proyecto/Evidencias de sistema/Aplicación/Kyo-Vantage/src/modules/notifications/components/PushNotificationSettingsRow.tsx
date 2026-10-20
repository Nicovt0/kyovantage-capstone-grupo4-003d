import React, { useState } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { sendPushTest } from '../services/pushNotificationService';

interface PushNotificationSettingsRowProps {
  className?: string;
  onNotificationChange?: (subscribed: boolean) => void;
}

export function PushNotificationSettingsRow({
  className = '',
  onNotificationChange,
}: PushNotificationSettingsRowProps) {
  const {
    isSupported,
    isSubscribed,
    permissionState,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  async function testPush() {
    if (isTesting) return;
    setIsTesting(true); setTestError(null); setFeedback(null);
    try { await sendPushTest(); setFeedback('Prueba enviada a este dispositivo. Comprueba las notificaciones del sistema.'); }
    catch (cause) { setTestError(cause instanceof Error ? cause.message : 'No se pudo enviar la prueba.'); }
    finally { setIsTesting(false); }
  }

  const handleToggle = async () => {
    if (isLoading) return;
    setFeedback(null);
    setTestError(null);

    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) {
        setFeedback('Notificaciones desactivadas.');
        onNotificationChange?.(false);
      }
    } else {
      const ok = await subscribe();
      if (ok) {
        setFeedback('Suscripción activada. Ya puedes enviar una notificación de prueba.');
        onNotificationChange?.(true);
      }
    }
  };

  const isDenied = permissionState === 'denied';

  const getSubtitle = () => {
    if (!isSupported) {
      return 'Requiere la app de staging con HTTPS, build de Vite y un navegador compatible.';
    }
    if (isDenied) {
      return 'Permiso bloqueado en los ajustes del navegador.';
    }
    if (isLoading) {
      return 'Configurando suscripción push...';
    }
    if (isSubscribed) {
      return 'Suscripción activa en este dispositivo. Recordatorios automáticos aún no habilitados.';
    }
    return 'Activa la suscripción para probar las notificaciones.';
  };

  return (
    <div className={`flex flex-col p-4 transition-colors ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
              isSubscribed
                ? 'bg-[#6d28d9] text-white shadow-md shadow-[#6d28d9]/30'
                : 'bg-default-100 dark:bg-surface-raised text-foreground'
            }`}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin text-[#6d28d9]" />
            ) : isSubscribed ? (
              <BellRing size={20} />
            ) : isDenied ? (
              <BellOff size={20} className="text-danger" />
            ) : (
              <Bell size={20} />
            )}
          </div>

          <div className="flex flex-col">
            <span className="font-bold text-[15px] text-foreground">
              Notificaciones push
            </span>
            <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">
              {getSubtitle()}
            </span>
          </div>
        </div>

        <div>
          {isSupported && !isDenied ? (
            <button
              type="button"
              role="switch"
              aria-checked={isSubscribed}
              aria-label="Activar notificaciones push"
              disabled={isLoading || isTesting}
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#6d28d9] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                isSubscribed ? 'bg-[#6d28d9]' : 'bg-[#E5E5EA] dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  isSubscribed ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          ) : isDenied ? (
            <span className="rounded-lg bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger">
              Bloqueado
            </span>
          ) : (
            <span className="rounded-lg bg-default-100 dark:bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-default-500">
              No compatible
            </span>
          )}
        </div>
      </div>

      {isSubscribed && <button type="button" disabled={isLoading || isTesting} onClick={() => void testPush()} className="mt-3 self-start rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold text-kyo-lightPurple disabled:opacity-50">{isTesting ? 'Enviando prueba…' : 'Enviar notificación de prueba'}</button>}
      {/* Inline feedback or error banner */}
      {(error || testError || feedback) && (
        <div
          className={`mt-2.5 rounded-xl p-2.5 text-xs font-medium ${
            error || testError
              ? 'bg-danger/10 text-danger border border-danger/20'
              : 'bg-[#6d28d9]/10 text-[#a78bfa] border border-[#6d28d9]/20'
          }`}
          role="alert"
        >
          {error || testError || feedback}
        </div>
      )}
    </div>
  );
}

export default PushNotificationSettingsRow;
