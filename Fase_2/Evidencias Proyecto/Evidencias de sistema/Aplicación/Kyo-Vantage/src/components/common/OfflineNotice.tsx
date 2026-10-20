import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Subtle, non-blocking floating banner that notifies the user when they are offline
 * or when the connection has been re-established. Designed with Tailwind CSS & glassmorphism.
 */
export function OfflineNotice() {
  const { isOffline, isReconnected, checkConnection } = useNetworkStatus();
  const [isChecking, setIsChecking] = useState(false);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      await checkConnection();
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  const showBanner = isOffline || isReconnected;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[9999] flex justify-center px-4 md:top-4"
      aria-live="polite"
      role="status"
    >
      <AnimatePresence mode="wait">
        {showBanner && (
          <motion.div
            key={isOffline ? 'offline' : 'reconnected'}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl transition-colors md:p-3.5 ${
              isOffline
                ? 'border-amber-500/30 bg-[#0c0a1d]/90 text-amber-200 shadow-amber-950/30 dark:bg-[#0c0a1d]/95'
                : 'border-emerald-500/30 bg-[#071714]/90 text-emerald-200 shadow-emerald-950/30 dark:bg-[#071714]/95'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isOffline
                    ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/20'
                    : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/20'
                }`}
              >
                {isOffline ? (
                  <WifiOff className="h-4.5 w-4.5 animate-pulse" />
                ) : (
                  <Wifi className="h-4.5 w-4.5" />
                )}
              </div>

              <div className="flex flex-col text-left">
                <span className="text-xs font-bold tracking-tight text-white">
                  {isOffline ? 'Sin conexión a Internet' : 'Conexión restablecida'}
                </span>
                <span className="text-[11px] leading-tight text-[#a0a0b8]">
                  {isOffline
                    ? 'Operando en modo local con datos en caché.'
                    : 'Sincronización en tiempo real reactivada.'}
                </span>
              </div>
            </div>

            {isOffline && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isChecking}
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-60"
                title="Comprobar conectividad"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 transition-transform ${
                    isChecking ? 'animate-spin' : 'group-hover:rotate-45'
                  }`}
                />
                <span className="hidden sm:inline">Reintentar</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OfflineNotice;
