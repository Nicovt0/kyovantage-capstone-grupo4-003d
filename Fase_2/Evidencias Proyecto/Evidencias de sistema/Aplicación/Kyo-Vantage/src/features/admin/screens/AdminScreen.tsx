import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AdminOverviewDashboard from '../components/AdminOverviewDashboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Users, UserCheck, Landmark, LayoutDashboard, Ticket, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { approveWaitlistRequest, rejectWaitlistRequest } from '@/features/admin/api/invitations';
import AdminMetricsDashboard from '@/features/admin/components/AdminMetricsDashboard';
import AdminUsersTab from '@/features/admin/components/AdminUsersTab';
import AdminBanksAndTemplatesTab from '@/features/admin/components/AdminBanksAndTemplatesTab';
import { AdminInvitationCodes } from '@/features/admin/components/AdminInvitationCodes';

type Status = 'pending' | 'approved' | 'rejected' | 'sent' | 'error';
type Request = {
  id: string;
  email: string;
  created_at: string;
  status: Status;
  approved_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  invitation_id: string | null;
  invitation: { code: string; is_used: boolean } | null;
};
const labels: Record<Status, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  sent: 'Enviada',
  error: 'Error de envío',
};

function AdminWaitlistTab() {
  const [rows, setRows] = useState<Request[]>([]);
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const rawFilter = params.get('status') || '';
  const filter: Status | '' = rawFilter in labels ? rawFilter as Status : '';
  const search = params.get('search') || '';
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const setFilter = (value: string) => setParams(previous => { previous.set('status', value); return previous; }, { replace: true });
  const setSearch = (value: string) => setParams(previous => { previous.set('search', value); return previous; }, { replace: true });
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(timer); }, [search]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    let query = createClient()
      .from('waitlist')
      .select('id,email,created_at,status,approved_at,sent_at,last_error,invitation_id,invitation:beta_invitations(code,is_used)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * 25, page * 25 + 24);
    if (filter) query = query.eq('status', filter);
    if (debouncedSearch.trim()) query = query.ilike('email', `%${debouncedSearch.trim().replace(/[%_\\]/g, '\\$&')}%`);
    try {
      const { data, error: loadError, count } = await query;
      if (sequence !== loadSequence.current) return;
      setLoadErrorMessage('');
      if (loadError) throw new Error(loadError.message);
      setRows((data ?? []) as unknown as Request[]);
      setTotal(count ?? 0);
    } catch (cause) {
      if (sequence !== loadSequence.current) return;
      setLoadErrorMessage(cause instanceof Error ? cause.message : 'No se pudo cargar la lista.');
      setRows([]); setTotal(0);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [filter, debouncedSearch, page]);

  useEffect(() => {
    void load();
    return () => { loadSequence.current++; };
  }, [load]);

  const dispatch = async (id: string) => {
    const { data, error: invokeError } = await createClient().functions.invoke('send-beta-invitation', {
      body: { waitlist_id: id },
    });
    if (invokeError || !data?.ok) {
      throw new Error(
        data?.error ||
          'No se pudo contactar el servicio de correo. Verifica que esté desplegado y configurado; la invitación permanece sin enviar.'
      );
    }
  };

  const act = async (row: Request, action: 'approve' | 'reject' | 'retry') => {
    setBusy(row.id);
    setNotice('');
    setError('');
    try {
      if (action === 'approve') {
        const { error: rpcError } = await approveWaitlistRequest(row.id);
        if (rpcError) throw rpcError;
        setNotice('Solicitud aprobada. El código está disponible en la lista; puedes copiarlo o enviar la invitación.');
      } else if (action === 'reject') {
        const { error: rpcError } = await rejectWaitlistRequest(row.id);
        if (rpcError) throw rpcError;
        setNotice('Solicitud rechazada.');
      } else {
        await dispatch(row.id);
        setNotice('Invitación enviada.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : 'No se pudo completar la operación.');
    } finally {
      await load();
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Solicitudes de acceso Beta</h2>
        <p className="mt-1 text-sm text-on-surface-card-secondary">
          Aprueba solicitudes para asignar un código al correo registrado. Puedes copiar el código o enviar la invitación cuando el servicio de correo esté habilitado.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle bg-surface-card p-4">
        <label className="text-sm flex items-center">
          Estado
          <select
            aria-label="Filtrar por estado"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Status | '');
              setPage(0);
            }}
            className="ml-2 rounded-lg border border-border-subtle bg-surface-card p-2"
          >
            <option value="">Todos</option>
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <input
          aria-label="Buscar por correo"
          placeholder="Buscar correo"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-border-subtle bg-surface-card p-2 text-foreground"
        />
        <button
          onClick={() => {
            setError('');
            void load();
          }}
          disabled={loading || Boolean(busy)}
          className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-50 hover:bg-surface-raised/50 transition"
        >
          Actualizar
        </button>
      </div>
      {loadErrorMessage && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{loadErrorMessage}</p>}
      {notice && (
        <p role="status" className="text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-on-surface-card-secondary">
          Cargando solicitudes…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-on-surface-card-secondary">No hay solicitudes para estos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-card/60">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-on-surface-card-secondary">
                <th className="p-3">Correo</th>
                <th className="p-3">Solicitud</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Código</th>
                <th className="p-3">Envío</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border-subtle hover:bg-surface-raised/40">
                  <td className="p-3">{row.email}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(row.created_at).toLocaleString('es-CL')}</td>
                  <td className="p-3">{labels[row.status]}</td>
                  <td className="p-3"><code className="select-text whitespace-nowrap text-kyo-lightPurple">{row.invitation?.code || 'Sin asignar'}</code>{row.invitation?.code && <button type="button" className="ml-2 text-xs underline" onClick={async () => { try { await navigator.clipboard.writeText(row.invitation!.code); setNotice('Código copiado.'); } catch { setError('No se pudo copiar el código. Puedes seleccionarlo manualmente.'); } }}>Copiar</button>}{row.invitation?.is_used && <span className="block text-xs text-on-surface-card-secondary">Utilizado</span>}</td>
                  <td className="p-3">
                    {row.sent_at ? new Date(row.sent_at).toLocaleString('es-CL') : row.last_error || 'Sin enviar'}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {row.status === 'pending' && (
                        <>
                          <button
                            disabled={Boolean(busy)}
                            onClick={() => void act(row, 'approve')}
                            className="rounded bg-kyo-purple px-3 py-2 disabled:opacity-50 hover:bg-kyo-purple/80 transition"
                          >
                            Aprobar
                          </button>
                          <button
                            disabled={Boolean(busy)}
                            onClick={() => void act(row, 'reject')}
                            className="rounded border border-border-subtle px-3 py-2 disabled:opacity-50 hover:bg-surface-raised/50 transition"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {(row.status === 'approved' || row.status === 'error') && (
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => void act(row, 'retry')}
                          className="rounded border border-border-subtle px-3 py-2 disabled:opacity-50 hover:bg-surface-raised/50 transition"
                        >
                          {row.status === 'approved' ? 'Enviar invitación' : 'Reintentar envío'}
                        </button>
                      )}
                      {busy === row.id && <span role="status">Procesando…</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-4 text-sm text-on-surface-card-secondary">
        <button
          disabled={page === 0 || loading || Boolean(busy)}
          onClick={() => setPage((value) => value - 1)}
          className="disabled:opacity-40 hover:text-foreground"
        >
          Anterior
        </button>
        <span>
          {total} solicitudes · Página {page + 1}
        </span>
        <button
          disabled={(page + 1) * 25 >= total || loading || Boolean(busy)}
          onClick={() => setPage((value) => value + 1)}
          className="disabled:opacity-40 hover:text-foreground"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}

type AdminTab = 'overview' | 'metrics' | 'banks' | 'users' | 'waitlist';
const sections = [
  { id: 'overview', label: 'Resumen', description: 'Lo que necesita tu atención', icon: LayoutDashboard },
  { id: 'waitlist', label: 'Acceso beta', description: 'Lista de Espera e invitaciones', icon: Ticket },
  { id: 'users', label: 'Usuarios y Roles', description: 'Perfiles, permisos y estado', icon: UserCheck },
  { id: 'banks', label: 'Bancos y Plantillas', description: 'Catálogo financiero oficial', icon: Landmark },
  { id: 'metrics', label: 'Métricas y Plataforma', description: 'Diagnóstico y actividad', icon: Activity },
] as const;

export default function AdminScreen() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('tab');
  const activeTab: AdminTab = sections.some(section => section.id === selected) ? selected as AdminTab : 'overview';
  const section = sections.find(section => section.id === activeTab)!;
  const codesView = activeTab === 'waitlist' && params.get('view') === 'codes';
  const handleTabChange = (tab: AdminTab) => setParams({ tab });
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <nav aria-label="Navegación del panel de administración" className="flex gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card p-2 lg:sticky lg:top-24 lg:flex-col">
          {sections.map(item => <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => handleTabChange(item.id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors lg:w-full ${activeTab === item.id ? 'bg-brand-primary/10 text-brand-primary dark:text-purple-300' : 'text-on-surface-card-secondary hover:bg-surface-raised hover:text-foreground'}`}>
            <item.icon size={18} className="shrink-0" /><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 hidden text-[11px] text-on-surface-card-secondary lg:block">{item.description}</span></span>
          </button>)}
        </nav>
      </aside>
      <div className="min-w-0 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-1 text-xs font-medium uppercase tracking-widest text-on-surface-card-secondary">Administración</p><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{section.label}</h1><p className="mt-2 text-sm text-on-surface-card-secondary">{activeTab === 'overview' ? 'Una vista rápida del acceso beta, los usuarios y tu catálogo.' : section.description}</p></div>
          {activeTab === 'overview' && <Link to="/admin?tab=waitlist&view=codes" className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"><Ticket size={16} />Gestionar invitaciones<ArrowUpRight size={15} /></Link>}
        </header>
        {activeTab === 'overview' && <AdminOverviewDashboard />}
        {activeTab === 'metrics' && <AdminMetricsDashboard />}
        {activeTab === 'banks' && <AdminBanksAndTemplatesTab />}
        {activeTab === 'users' && <AdminUsersTab />}
        {activeTab === 'waitlist' && <>
          <div className="inline-flex gap-1 rounded-xl border border-border-subtle bg-surface-card p-1">
            <Link to="/admin?tab=waitlist" aria-current={!codesView ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${!codesView ? 'bg-brand-primary text-white' : 'text-on-surface-card-secondary hover:text-foreground'}`}>Solicitudes</Link>
            <Link to="/admin?tab=waitlist&view=codes" aria-current={codesView ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium ${codesView ? 'bg-brand-primary text-white' : 'text-on-surface-card-secondary hover:text-foreground'}`}>Códigos de invitación</Link>
          </div>
          {codesView ? <AdminInvitationCodes /> : <AdminWaitlistTab />}
        </>}
      </div>
    </div>
  );
}
