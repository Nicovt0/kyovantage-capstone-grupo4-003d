import { createClient } from '../../../utils/supabase/client.ts';
import { USE_MOCKS } from '../../../shared/lib/serviceConfig.ts';

export interface PlatformHealth {
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  database: 'connected' | 'disconnected';
  authService: 'operational' | 'degraded';
  checkedAt: string;
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalCommitments: number;
  projectedMonthlyCommitments: number;
  totalAccounts: number;
  totalManagedBalance: number;
  systemHealth: PlatformHealth;
}

export type ActivityAction =
  | 'Solicitud Beta'
  | 'Invitación Aprobada'
  | 'Invitación Rechazada'
  | 'Cuenta Creada'
  | 'Transacción'
  | 'Compromiso Agendado'
  | 'Actualización de Perfil';

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: ActivityAction;
  entity: 'Waitlist' | 'Cuenta' | 'Transacción' | 'Agenda' | 'Perfil' | 'Sistema';
  status: 'success' | 'pending' | 'warning' | 'error';
  details?: string;
}

const mockStats: PlatformStats = {
  totalUsers: 142,
  activeUsers: 98,
  totalCommitments: 324,
  projectedMonthlyCommitments: 14850000,
  totalAccounts: 215,
  totalManagedBalance: 42890000,
  systemHealth: {
    status: 'healthy',
    latencyMs: 34,
    database: 'connected',
    authService: 'operational',
    checkedAt: new Date().toISOString(),
  },
};

const mockActivityLogs: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    user: 'carla.mendoza@example.com',
    action: 'Invitación Aprobada',
    entity: 'Waitlist',
    status: 'success',
    details: 'Código de invitación generado',
  },
  {
    id: 'act-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    user: 'rodrigo.s@example.com',
    action: 'Cuenta Creada',
    entity: 'Cuenta',
    status: 'success',
    details: 'Cuenta Corriente Banco de Chile',
  },
  {
    id: 'act-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    user: 'diego.araya@example.com',
    action: 'Compromiso Agendado',
    entity: 'Agenda',
    status: 'success',
    details: 'Arriendo mensual programado',
  },
  {
    id: 'act-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    user: 'valentina.p@example.com',
    action: 'Solicitud Beta',
    entity: 'Waitlist',
    status: 'pending',
    details: 'Esperando revisión de acceso',
  },
  {
    id: 'act-5',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    user: 'felipe.morales@example.com',
    action: 'Transacción',
    entity: 'Transacción',
    status: 'success',
    details: 'Pago registrado $45.000',
  },
];

/**
 * Queries aggregated metrics: active users, total commitments, managed accounts and platform health.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  if (USE_MOCKS) {
    return {
      ...mockStats,
      systemHealth: {
        ...mockStats.systemHealth,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  const supabase = createClient();
  const started = performance.now();
  const results = await Promise.all([
    supabase.from('profiles').select('id,created_at,updated_at', { count: 'exact' }),
    supabase.from('recurring_templates').select('id,expected_amount,is_active,frequency', { count: 'exact' }),
    supabase.from('accounts').select('id,balance,is_archived', { count: 'exact' }),
  ]);
  const failure = results.find(result => result.error)?.error;
  if (failure) throw new Error(`No se pudieron cargar las métricas: ${failure.message}`);
  if (results.some(result => result.count != null && (result.data?.length ?? 0) < result.count)) throw new Error('El servidor limitó las filas de las métricas detalladas. Usa los conteos del Resumen; los importes parciales no se muestran.');
  const [profilesResult, templatesResult, accountsResult] = results;
  const profiles = profilesResult.data || [];
  const templates = (templatesResult.data || []).filter(row => row.is_active !== false);
  const accounts = (accountsResult.data || []).filter(row => !row.is_archived);
  const cutoff = Date.now() - 30 * 86400000;
  const latencyMs = Math.max(1, Math.round(performance.now() - started));
  return {
    totalUsers: profilesResult.count ?? profiles.length,
    activeUsers: profiles.filter(row => new Date(row.updated_at || row.created_at).getTime() >= cutoff).length,
    totalCommitments: templates.length,
    projectedMonthlyCommitments: templates.reduce((sum, row) => {
      const factor = row.frequency === 'yearly' ? 1 / 12 : row.frequency === 'quarterly' ? 1 / 3 : row.frequency === 'weekly' ? 52 / 12 : 1;
      return sum + Number(row.expected_amount || 0) * factor;
    }, 0),
    totalAccounts: accounts.length,
    totalManagedBalance: accounts.reduce((sum, row) => sum + Number(row.balance || 0), 0),
    systemHealth: { status: latencyMs > 800 ? 'degraded' : 'healthy', latencyMs, database: 'connected', authService: 'operational', checkedAt: new Date().toISOString() },
  };
}

/**
 * Retrieves the latest relevant activity logs across entities.
 */
export async function getRecentActivityLogs(): Promise<ActivityLog[]> {
  if (USE_MOCKS) {
    return Promise.resolve(mockActivityLogs);
  }

  const supabase = createClient();
  const results = await Promise.all([
    supabase.from('waitlist').select('id,email,status,created_at,approved_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('accounts').select('id,name,created_at,user_id').order('created_at', { ascending: false }).limit(6),
    supabase.from('transactions').select('id,name,created_at,date,user_id').order('created_at', { ascending: false }).limit(6),
  ]);
  const failure = results.find(result => result.error)?.error;
  if (failure) throw new Error(`No se pudo cargar la actividad reciente: ${failure.message}`);
  const logs: ActivityLog[] = [];
  for (const row of results[0].data || []) {
    const approved = row.status === 'approved' || row.status === 'sent';
    logs.push({ id: `wl-${row.id}`, timestamp: approved ? row.approved_at || row.created_at : row.created_at, user: row.email || 'Usuario', action: approved ? 'Invitación Aprobada' : row.status === 'rejected' ? 'Invitación Rechazada' : 'Solicitud Beta', entity: 'Waitlist', status: approved ? 'success' : row.status === 'rejected' ? 'warning' : row.status === 'error' ? 'error' : 'pending', details: `Estado: ${row.status}` });
  }
  for (const row of results[1].data || []) logs.push({ id: `acc-${row.id}`, timestamp: row.created_at, user: `Usuario (${row.user_id?.slice(0,6) || 'sin identificador'})`, action: 'Cuenta Creada', entity: 'Cuenta', status: 'success', details: row.name });
  for (const row of results[2].data || []) logs.push({ id: `tx-${row.id}`, timestamp: row.created_at || row.date, user: `Usuario (${row.user_id?.slice(0,6) || 'sin identificador'})`, action: 'Transacción', entity: 'Transacción', status: 'success', details: row.name });
  return logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0,15);
}
