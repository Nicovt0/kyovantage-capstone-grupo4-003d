import { createClient } from 'npm:@supabase/supabase-js@2.48.0';
import webpush from 'npm:web-push@3.6.7';

// Staging only. The caller can send the fixed test payload solely to their own endpoint.
Deno.serve(async (request: Request) => {
  const appUrl = Deno.env.get('APP_URL') || '';
  let origin = '';
  try { origin = new URL(appUrl).origin; } catch { /* Fail closed below. */ }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' };
  if (request.headers.get('origin') === origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  const respond = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || (request.headers.get('origin') && request.headers.get('origin') !== origin)) return respond({ error: 'Origen no permitido.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);
  if (Deno.env.get('APP_ENV') !== 'development' || Deno.env.get('ENABLE_PUSH_TEST') !== 'true') return respond({ error: 'La prueba push está deshabilitada en este entorno.' }, 503);
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY'); const privateKey = Deno.env.get('VAPID_PRIVATE_KEY'); const subject = Deno.env.get('VAPID_SUBJECT');
  if (!url || !anon || !publicKey || !privateKey || !subject) return respond({ error: 'Falta configurar el servicio push en staging.' }, 503);
  const bearer = request.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) return respond({ error: 'Sesión requerida.' }, 401);
  const client = createClient(url, anon, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(bearer.slice(7));
  if (authError || !user) return respond({ error: 'Sesión inválida.' }, 401);
  let endpoint: string;
  try {
    const body = await request.json(); endpoint = body.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length > 4096) throw new Error();
    const target = new URL(endpoint);
    const host = target.hostname;
    const allowed = host === 'fcm.googleapis.com' || host === 'web.push.apple.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') || host.endsWith('.notify.windows.com');
    if (!allowed || target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443')) throw new Error();
  } catch { return respond({ error: 'Endpoint push no válido o proveedor no admitido.' }, 400); }
  const { data: subscription, error: readError } = await client.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', user.id).eq('endpoint', endpoint).maybeSingle();
  if (readError) return respond({ error: 'No se pudo consultar la suscripción.' }, 500);
  if (!subscription) return respond({ error: 'No existe una suscripción propia para este dispositivo.' }, 404);
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ title: 'Kyo Vantage', body: 'Las notificaciones push de prueba funcionan en este dispositivo.', url: '/settings' }),
      { vapidDetails: { subject, publicKey, privateKey }, TTL: 60, timeout: 10000 });
    return respond({ ok: true });
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await client.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
      return respond({ error: 'La suscripción caducó. Desactiva y vuelve a activar las notificaciones.' }, 410);
    }
    return respond({ error: 'El proveedor no aceptó la prueba. Revisa las claves VAPID y la configuración del servidor.' }, 502);
  }
});
