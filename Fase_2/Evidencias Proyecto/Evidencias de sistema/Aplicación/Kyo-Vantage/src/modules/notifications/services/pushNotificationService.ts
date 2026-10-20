import { createClient } from '../../../utils/supabase/client.ts';
import type { PushSubscriptionRecord } from '../../../types/notification.ts';
import { isAppOrigin } from '../../../pwa/policy.ts';

/**
 * Converts a base64 URL-encoded VAPID public key to a Uint8Array
 * required by the browser's PushManager.subscribe().
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Checks whether the current environment supports the Web Push API.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    import.meta.env?.PROD === true &&
    isAppOrigin(window.location.origin, import.meta.env?.VITE_APP_URL) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Retrieves the configured VAPID public key from environment variables.
 */
export function getVapidPublicKey(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) {
    return import.meta.env.VITE_VAPID_PUBLIC_KEY;
  }
  return '';
}

export function assertVapidPublicKey(key: string): void {
  try {
    const bytes = urlBase64ToUint8Array(key);
    if (bytes.length === 65 && bytes[0] === 4) return;
  } catch { /* Report configuration rather than a browser subscription error. */ }
  throw new Error('Falta configurar una clave VAPID pública válida en el build de staging.');
}

export async function sendPushTest(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) throw new Error('Activa primero las notificaciones en este dispositivo.');
  const { data, error } = await createClient().functions.invoke('send-push-test', { body: { endpoint: subscription.endpoint } });
  if (error || !data?.ok) throw new Error(data?.error || 'No se pudo enviar la prueba. Comprueba la configuración del servicio en staging.');
}

/**
 * Retrieves the active Service Worker registration.
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    // The landing and development builds intentionally have no registration.
    // `ready` would otherwise wait forever when no worker is being installed.
    const registration = await navigator.serviceWorker.getRegistration('/');
    return registration?.active ? registration : null;
  } catch (error) {
    console.error('[pushNotificationService] Error getting Service Worker registration:', error);
    return null;
  }
}

/**
 * Returns the existing PushSubscription from the PushManager, if any.
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration || !registration.pushManager) return null;

  try {
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[pushNotificationService] Error querying push subscription:', error);
    return null;
  }
}

export async function hasSavedPushSubscription(endpoint: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.from('push_subscriptions').select('id').eq('user_id', user.id).eq('endpoint', endpoint).maybeSingle();
  if (error) throw new Error('No se pudo comprobar la suscripción guardada.');
  return Boolean(data);
}

/**
 * Registers a new subscription with the browser's PushManager using VAPID key.
 */
export async function subscribeToPush(vapidPublicKey?: string): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error('Notificaciones push no soportadas en este navegador.');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration || !registration.pushManager) {
    throw new Error('Service Worker no está activo o no soporta PushManager.');
  }

  const key = vapidPublicKey || getVapidPublicKey();
  assertVapidPublicKey(key);
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const options: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
  };

  if (key) {
    options.applicationServerKey = urlBase64ToUint8Array(key) as unknown as BufferSource;
  }

  return await registration.pushManager.subscribe(options);
}

/**
 * Persists or updates the push subscription record in Supabase.
 */
export async function savePushSubscription(
  subscription: PushSubscription
): Promise<{ success: boolean; data?: PushSubscriptionRecord; error?: string }> {
  const supabase = createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData?.user) {
    return { success: false, error: 'Usuario no autenticado en Supabase.' };
  }

  const subJson = subscription.toJSON();
  const p256dh = subJson.keys?.p256dh || '';
  const auth = subJson.keys?.auth || '';

  if (!p256dh || !auth) {
    return { success: false, error: 'La suscripción no contiene claves criptográficas p256dh o auth válidas.' };
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userData.user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('[pushNotificationService] Error saving subscription to database:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as PushSubscriptionRecord };
}

/**
 * Removes a push subscription endpoint from Supabase.
 */
export async function deletePushSubscription(endpoint: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[pushNotificationService] Error removing subscription from database:', error);
    return false;
  }

  return true;
}

/**
 * Cancels push subscription both at browser PushManager and Supabase database.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const currentSub = await getCurrentPushSubscription();
  if (!currentSub) return true;

  const endpoint = currentSub.endpoint;

  try {
    // 1. Unsubscribe at browser PushManager
    if (!(await currentSub.unsubscribe())) return false;
  } catch (err) {
    console.warn('[pushNotificationService] Error unsubscribing from PushManager:', err);
    return false;
  }

  // 2. Remove from database
  return await deletePushSubscription(endpoint);
}
