import React from 'react';
import {
  Users,
  CalendarCheck,
  Wallet,
  Activity,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Database,
  ShieldCheck,
  Server,
} from 'lucide-react';
import {
  useAdminMetricsDashboard,
} from '../hooks/useAdminMetrics';
import type { ActivityLog } from '../api/adminMetricsRepository';

export function AdminMetricsDashboard() {
  const { statsQuery, activityLogsQuery, refetchAll, isRefreshing } =
    useAdminMetricsDashboard();

  const stats = statsQuery.data;
  const logs = activityLogsQuery.data ?? [];
  const isLoading = statsQuery.isLoading || activityLogsQuery.isLoading;
  const isError = statsQuery.isError || activityLogsQuery.isError;
  const errorMessage =
    statsQuery.error?.message ||
    activityLogsQuery.error?.message ||
    'Ocurrió un error al cargar las métricas.';

  const formatCLP = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: ActivityLog['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Éxito
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <AlertTriangle className="w-3 h-3" />
            Alerta
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Fallo
          </span>
        );
    }
  };

  const getEntityBadge = (entity: ActivityLog['entity']) => {
    const colorClasses: Record<string, string> = {
      Waitlist: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      Cuenta: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      Transacción: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      Agenda: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
      Perfil: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
      Sistema: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs border ${
          colorClasses[entity] || 'bg-surface-raised/50 text-on-surface-card-body border-border-subtle'
        }`}
      >
        {entity}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border-subtle">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Métricas y Salud de la Plataforma
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-kyo-purple/30 text-kyo-lightPurple border border-kyo-purple/40">
              Consulta bajo demanda
            </span>
          </h2>
          <p className="mt-1 text-sm text-on-surface-card-secondary">
            Cifras de perfiles, compromisos y cuentas visibles para tu sesión. La actividad reciente no reemplaza un registro de auditoría.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats?.systemHealth && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border-subtle text-xs text-on-surface-card-secondary">
              <div
                className={`w-2 h-2 rounded-full ${
                  stats.systemHealth.status === 'healthy'
                    ? 'bg-emerald-400 animate-pulse'
                    : stats.systemHealth.status === 'degraded'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span>Ping: {stats.systemHealth.latencyMs}ms</span>
            </div>
          )}

          <button
            onClick={() => void refetchAll()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-card hover:bg-surface-raised border border-border-subtle text-sm font-medium text-foreground transition-all disabled:opacity-50 active:scale-95 shadow-sm"
            aria-label="Actualizar métricas"
          >
            <RotateCw
              className={`w-4 h-4 text-kyo-lightPurple ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>{isRefreshing ? 'Actualizando…' : 'Refrescar'}</span>
          </button>
        </div>
      </div>

      {/* Error state banner */}
      {isError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-200"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Error de sincronización de métricas</h3>
            <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => void refetchAll()}
            className="px-3 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold text-foreground transition"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Usuarios */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-card/80 border border-border-subtle p-5 backdrop-blur-md shadow-lg transition-all hover:border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-secondary">
              Usuarios Registrados
            </span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-kyo-lightPurple border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="h-9 w-24 rounded bg-surface-raised animate-pulse" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {stats?.totalUsers.toLocaleString('es-CL')}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-card-secondary">
              {isLoading ? (
                <div className="h-4 w-36 rounded bg-surface-raised/50 animate-pulse" />
              ) : (
                <>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400">
                    {stats?.activeUsers} perfiles actualizados
                  </span>
                  <span>en los últimos 30 días</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Compromisos Mensuales */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-card/80 border border-border-subtle p-5 backdrop-blur-md shadow-lg transition-all hover:border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-secondary">
              Compromisos del Mes
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="h-9 w-32 rounded bg-surface-raised animate-pulse" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {formatCLP(stats?.projectedMonthlyCommitments || 0)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-card-secondary">
              {isLoading ? (
                <div className="h-4 w-36 rounded bg-surface-raised/50 animate-pulse" />
              ) : (
                <>
                  <span className="text-foreground font-medium">
                    {stats?.totalCommitments} compromisos
                  </span>
                  <span>activos en agenda</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Volumen Administrado */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-card/80 border border-border-subtle p-5 backdrop-blur-md shadow-lg transition-all hover:border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-secondary">
              Volumen Gestionado
            </span>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="h-9 w-32 rounded bg-surface-raised animate-pulse" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {formatCLP(stats?.totalManagedBalance || 0)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-card-secondary">
              {isLoading ? (
                <div className="h-4 w-36 rounded bg-surface-raised/50 animate-pulse" />
              ) : (
                <>
                  <span className="text-foreground font-medium">
                    {stats?.totalAccounts} cuentas
                  </span>
                  <span>registradas en total</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Salud Supabase & Servicios */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-card/80 border border-border-subtle p-5 backdrop-blur-md shadow-lg transition-all hover:border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-card-secondary">
              Salud Supabase
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="h-9 w-28 rounded bg-surface-raised animate-pulse" />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-extrabold tracking-tight ${
                    stats?.systemHealth.status === 'healthy'
                      ? 'text-emerald-400'
                      : stats?.systemHealth.status === 'degraded'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {stats?.systemHealth.status === 'healthy'
                    ? 'Operativo'
                    : stats?.systemHealth.status === 'degraded'
                    ? 'Degradado'
                    : 'Sin Conexión'}
                </span>
                <span
                  className={`relative flex h-2.5 w-2.5 ${
                    stats?.systemHealth.status === 'healthy' ? '' : 'hidden'
                  }`}
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-xs text-on-surface-card-secondary">
              {isLoading ? (
                <div className="h-4 w-36 rounded bg-surface-raised/50 animate-pulse" />
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-on-surface-card-secondary" />
                    DB: {stats?.systemHealth.database === 'connected' ? 'Conectada' : 'Error'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Server className="w-3 h-3 text-on-surface-card-secondary" />
                    Latencia: {stats?.systemHealth.latencyMs}ms
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Logs Audit Table */}
      <div className="rounded-2xl bg-surface-card/70 border border-border-subtle overflow-hidden shadow-card-soft">
        <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-kyo-lightPurple" />
              Registro de Auditoría y Eventos Recientes
            </h3>
            <p className="text-xs text-on-surface-card-secondary mt-0.5">
              Trazabilidad operativa de solicitudes beta, creación de cuentas y movimientos en la plataforma.
            </p>
          </div>
          <span className="text-xs text-on-surface-card-secondary self-start sm:self-auto">
            {logs.length} eventos registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Tabla de auditoría de actividad">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-raised/40 text-xs font-semibold text-on-surface-card-secondary uppercase tracking-wider">
                <th className="px-5 py-3.5">Fecha y Hora</th>
                <th className="px-5 py-3.5">Usuario / Identificador</th>
                <th className="px-5 py-3.5">Acción</th>
                <th className="px-5 py-3.5">Entidad</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[#d1d1e0]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-4 w-28 bg-surface-raised rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-40 bg-surface-raised rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-24 bg-surface-raised rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-16 bg-surface-raised rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-16 bg-surface-raised rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-36 bg-surface-raised rounded" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-on-surface-card-secondary">
                    No se han registrado eventos recientes en la plataforma.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateFormatted = new Date(log.timestamp).toLocaleString('es-CL', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-on-surface-card-secondary">
                        {dateFormatted}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground max-w-[200px] truncate">
                        {log.user}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-foreground text-xs">
                        {log.action}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getEntityBadge(log.entity)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-on-surface-card-secondary max-w-[260px] truncate">
                        {log.details || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-border-subtle bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-on-surface-card-secondary">
          <span>
            {stats?.systemHealth?.checkedAt
              ? `Último chequeo: ${new Date(
                  stats.systemHealth.checkedAt
                ).toLocaleTimeString('es-CL')}`
              : 'Actualización en tiempo real'}
          </span>
          <span className="text-[11px] text-foreground/40">
            TanStack Query · Stale time: 60s
          </span>
        </div>
      </div>
    </div>
  );
}

export default AdminMetricsDashboard;
