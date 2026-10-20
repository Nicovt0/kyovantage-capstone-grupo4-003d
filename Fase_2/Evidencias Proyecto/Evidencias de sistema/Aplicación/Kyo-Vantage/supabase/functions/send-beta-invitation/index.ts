import { createClient } from 'npm:@supabase/supabase-js@2.48.0';

// Set ENABLE_INVITATION_EMAIL=true only after the owner authorizes live sends.
// Required secrets: RESEND_API_KEY, INVITATION_FROM, APP_URL.
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are server-side only.
Deno.serve(async (request: Request) => {
  const appUrl = Deno.env.get('APP_URL') || '';
  const allowedOrigins = (Deno.env.get('INVITATION_ALLOWED_ORIGINS') || appUrl).split(',').map(value => {
    try { return new URL(value.trim()).origin; } catch { return ''; }
  }).filter(Boolean);
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Vary': 'Origin' };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  const respond = (value: object, status = 200) => new Response(JSON.stringify(value), { status, headers });
  if (origin && !allowedOrigins.includes(origin)) return respond({ ok: false, error: 'Origen no permitido.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ ok: false, error: 'Método no permitido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return respond({ ok: false, error: 'Servicio de invitaciones sin configurar.' }, 503);
  const bearer = request.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) return respond({ ok: false, error: 'Sesión requerida.' }, 401);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(bearer.slice(7));
  if (authError || !user) return respond({ ok: false, error: 'Sesión inválida.' }, 401);
  const role = user.app_metadata?.role;
  if (role !== 'admin' && !(role === 'superadmin' && Deno.env.get('APP_ENV') === 'development')) return respond({ ok: false, error: 'Acceso administrativo requerido.' }, 403);
  let id: string;
  try {
    const body = await request.json();
    id = body.waitlist_id;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error();
  } catch { return respond({ ok: false, error: 'Solicitud inválida.' }, 400); }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = crypto.randomUUID();
  const { data, error: claimError } = await admin.rpc('claim_beta_dispatch', { p_id: id, p_token: token });
  if (claimError || !data?.[0]) return respond({ ok: false, error: 'Solicitud no aprobada, enviada o con un envío en curso.' }, 409);
  const invitation = data[0] as { email: string; code: string; invitation_id: string };
  let failure: string | null = null;
  try {
    if (Deno.env.get('ENABLE_INVITATION_EMAIL') !== 'true') throw new Error('El envío de invitaciones está deshabilitado.');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('INVITATION_FROM');
    if (!resendKey || !from || !appUrl) throw new Error('Falta configurar proveedor, remitente o URL de la aplicación.');
    const target = new URL('/register', appUrl);
    if (target.protocol !== 'https:' && target.hostname !== 'localhost') throw new Error('La URL de la aplicación debe usar HTTPS.');
    target.searchParams.set('code', invitation.code);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `beta-invitation-${invitation.invitation_id}` },
      body: JSON.stringify({ from, to: [invitation.email], subject: 'Tu invitación a Kyo Vantage', text: `Tu acceso a la Beta de Kyo Vantage fue aprobado.\n\nCódigo: ${invitation.code}\nRegístrate con este mismo correo: ${target.toString()}\n\nEl código se puede usar una sola vez.` }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`El proveedor de correo rechazó el envío (${response.status}).`);
  } catch (cause) { failure = cause instanceof Error ? cause.message : 'Error al enviar la invitación.'; }
  const { data: finished, error: finishError } = await admin.rpc('finish_beta_dispatch', { p_id: id, p_token: token, p_error: failure });
  if (finishError || !finished) return respond({ ok: false, error: 'No se pudo confirmar el estado del envío. Actualiza la lista antes de reintentar.' }, 503);
  if (failure) return respond({ ok: false, error: failure }, 503);
  return respond({ ok: true });
});
