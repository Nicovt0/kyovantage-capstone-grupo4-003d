import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getCurrentPushSubscription,
  subscribeToPush,
  savePushSubscription,
  unsubscribeFromPush,
  assertVapidPublicKey,
  getVapidPublicKey,
  hasSavedPushSubscription,
} from '../services/pushNotificationService';

export interface UsePushNotificationsReturn {
  /** True if the browser and context support the Web Push API */
  isSupported: boolean;
  /** True if there is an active registered push subscription */
  isSubscribed: boolean;
  /** Current browser notification permission state ('default' | 'granted' | 'denied') */
  permissionState: NotificationPermission;
  /** True while subscribing or unsubscribing */
  isLoading: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Requests permission, registers with PushManager, and saves to database */
  subscribe: () => Promise<boolean>;
  /** Unsubscribes from PushManager and removes from database */
  unsubscribe: () => Promise<boolean>;
}

/**
 * Hook for managing Web Push notification subscriptions and browser permissions.
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const supported = isPushSupported();
  const [isSupported] = useState<boolean>(supported);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize initial subscription and permission state
  useEffect(() => {
    let isMounted = true;

    async function checkSubscription() {
      if (!isSupported) return;

      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }

      try {
        const sub = await getCurrentPushSubscription();
        const saved = sub ? await hasSavedPushSubscription(sub.endpoint) : false;
        if (isMounted) {
          setIsSubscribed(saved);
        }
      } catch (err) {
        console.warn('[usePushNotifications] Error checking initial subscription:', err);
      }
    }

    void checkSubscription();

    return () => {
      isMounted = false;
    };
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Este navegador o dispositivo no soporta notificaciones push.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      assertVapidPublicKey(getVapidPublicKey());
      // 1. Request native notification permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === 'denied') {
        setError('Permiso denegado. Puedes habilitar las notificaciones desde la configuración de tu navegador.');
        return false;
      }

      if (permission !== 'granted') {
        setError('No se concedieron permisos de notificación.');
        return false;
      }

      // 2. Register push subscription with the Service Worker PushManager
      const subscription = await subscribeToPush();

      // 3. Persist subscription in Supabase
      const saveResult = await savePushSubscription(subscription);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'No fue posible registrar la suscripción en la base de datos.');
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al activar las notificaciones.';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!(await unsubscribeFromPush())) throw new Error('No se pudo completar la desactivación. Inténtalo nuevamente.');
      setIsSubscribed(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al desactivar las notificaciones.';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permissionState,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  };
}
