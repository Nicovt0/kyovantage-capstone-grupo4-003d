import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  /** True when the browser has network connectivity */
  isOnline: boolean;
  /** True when the browser is offline */
  isOffline: boolean;
  /** True if the user experienced an offline state during this session */
  wasOffline: boolean;
  /** Temporarily true for 4 seconds when connectivity is restored */
  isReconnected: boolean;
  /** Helper function to manually verify connection */
  checkConnection: () => Promise<boolean>;
}

/**
 * Hook that listens to browser online/offline events and tracks connectivity state.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isReconnected, setIsReconnected] = useState<boolean>(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    try {
      // Fast cache-busting check against a tiny resource or current origin
      const response = await fetch('/icons/pwa-192.png', {
        method: 'HEAD',
        cache: 'no-store',
      });
      const online = response.ok;
      setIsOnline(online);
      return online;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let reconnectedTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(prev => {
        if (prev) {
          setIsReconnected(true);
          if (reconnectedTimer) clearTimeout(reconnectedTimer);
          reconnectedTimer = setTimeout(() => {
            setIsReconnected(false);
          }, 4000);
        }
        return prev;
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setIsReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectedTimer) clearTimeout(reconnectedTimer);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    isReconnected,
    checkConnection,
  };
}
