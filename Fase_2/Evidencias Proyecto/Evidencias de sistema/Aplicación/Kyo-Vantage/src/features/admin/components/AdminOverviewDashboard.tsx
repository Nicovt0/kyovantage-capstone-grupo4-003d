import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Users, UserPlus, Ticket, Landmark, RefreshCw, CheckCircle2, Inbox } from 'lucide-react';
import { getAdminOverview } from '../api/adminOverviewRepository';
import { useAuth } from '@/features/auth/components/AuthProvider';
const date = (value: string) => new Date(value).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
const statusLabels: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', sent: 'Enviada', error: 'Error de envío' };
export default function AdminOverviewDashboard() {
  const { auth } = useAuth();
  const query = useQuery({ queryKey: ['admin', auth.id, 'overview'], queryFn: getAdminOverview, enabled: Boolean(auth.id), staleTime: 60000, refetchOnWindowFocus: false, retry: 1 });
  const data = query.data;
  const metrics = [
    { label: 'Solicitudes pendientes', value: data?.pendingRequests, icon: Inbox, to: '/admin?tab=waitlist&status=pending', detail: 'Por revisar en la lista de espera', highlight: Boolean(data?.pendingRequests) },
    { label: 'Usuarios registrados', value: data?.users, icon: Users, to: '/admin?tab=users', detail: 'Perfiles existentes en la plataforma' },
    { label: 'Códigos disponibles', value: data?.availableCodes, icon: Ticket, to: '/admin?tab=waitlist&view=codes', detail: 'Invitaciones que aún no se utilizan' },
    { label: 'Códigos utilizados', value: data?.usedCodes, icon: CheckCircle2, to: '/admin?tab=waitlist&view=codes', detail: 'Invitaciones consumidas en el registro' },
  ];
  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-on-surface-card-secondary">{query.dataUpdatedAt ? `Última actualización: ${new Date(query.dataUpdatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : 'Cargando el resumen de la plataforma…'}</p>
      <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} />Actualizar resumen</button>
    </div>
    {query.isError && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">{query.error.message}{data && ' Se conservan las últimas cifras cargadas.'}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(item => <Link key={item.label} to={item.to} className={`group rounded-2xl border p-5 transition-colors hover:border-brand-primary/60 ${item.highlight ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-border-subtle bg-surface-card'}`}>
        <div className="mb-5 flex items-center justify-between"><item.icon size={19} className="text-on-surface-card-secondary" /><ArrowUpRight size={16} className="text-on-surface-card-secondary group-hover:text-kyo-lightPurple" /></div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{item.value === undefined ? '—' : item.value.toLocaleString('es-CL')}</p>
        <h3 className="mt-1 text-sm font-medium">{item.label}</h3><p className="mt-2 text-xs text-on-surface-card-secondary">{item.detail}</p>
      </Link>)}
    </div>
    {data && <>
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${data.pendingRequests ? 'border-brand-primary/30 bg-brand-primary/5' : 'border-border-subtle bg-surface-card'}`}>
        <div><h3 className="font-semibold">{data.pendingRequests ? `${data.pendingRequests} solicitudes esperan revisión` : 'No hay solicitudes pendientes'}</h3><p className="mt-1 text-sm text-on-surface-card-secondary">{data.pendingRequests ? 'Aprueba el acceso y asigna una invitación desde la lista de espera.' : 'Puedes generar invitaciones o revisar la actividad reciente.'}</p></div>
        <Link to={data.pendingRequests ? '/admin?tab=waitlist&status=pending' : '/admin?tab=waitlist&view=codes'} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">{data.pendingRequests ? 'Revisar solicitudes' : 'Gestionar códigos'}</Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-card">
          <div className="flex items-center justify-between border-b border-border-subtle p-5"><h3 className="flex items-center gap-2 font-semibold"><Inbox size={17} />Solicitudes recientes</h3><Link to="/admin?tab=waitlist" className="text-xs text-brand-primary dark:text-kyo-lightPurple">Ver todas</Link></div>
          {!data.recentRequests.length && <p className="p-5 text-sm text-on-surface-card-secondary">Todavía no hay solicitudes.</p>}
          {data.recentRequests.map(row => <Link to={`/admin?tab=waitlist&search=${encodeURIComponent(row.email)}`} key={row.id} className="flex items-center justify-between gap-3 border-b border-border-subtle p-4 last:border-0 hover:bg-surface-raised/50"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.email}</p><p className="mt-1 text-xs text-on-surface-card-secondary">{date(row.created_at)}</p></div><span className="shrink-0 rounded-lg bg-surface-raised px-2 py-1 text-xs">{statusLabels[row.status] || row.status}</span></Link>)}
        </section>
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-card">
          <div className="flex items-center justify-between border-b border-border-subtle p-5"><h3 className="flex items-center gap-2 font-semibold"><UserPlus size={17} />Últimos registros</h3><Link to="/admin?tab=users" className="text-xs text-brand-primary dark:text-kyo-lightPurple">Ver usuarios</Link></div>
          {!data.recentUsers.length && <p className="p-5 text-sm text-on-surface-card-secondary">Todavía no hay perfiles registrados.</p>}
          {data.recentUsers.map(row => <div key={row.id} className="flex items-center gap-3 border-b border-border-subtle p-4 last:border-0"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-on-surface-card-secondary"><Users size={16} /></div><div><p className="text-sm font-medium">{row.full_name || 'Usuario sin nombre'}</p><p className="mt-1 text-xs text-on-surface-card-secondary">Registro: {date(row.created_at)}</p></div></div>)}
        </section>
      </div>
      <Link to="/admin?tab=banks" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-card p-5 hover:border-brand-primary/50"><span className="flex items-center gap-3 font-medium"><Landmark size={19} />Catálogo financiero</span><span className="text-sm text-on-surface-card-secondary">{data.activeBanks} bancos activos · {data.accountTemplates} plantillas de cuenta · {data.cardTemplates} de tarjeta</span><ArrowUpRight size={17} /></Link>
    </>}
  </section>;
}
