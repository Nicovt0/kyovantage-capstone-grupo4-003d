import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, RefreshCw, Search } from 'lucide-react';
import { generateBetaInvitation, getBetaInvitationPage } from '../api/invitations';
import { useAuth } from '@/features/auth/components/AuthProvider';

export function AdminInvitationCodes() {
  const { auth } = useAuth();
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'all' | 'available' | 'used'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['admin', auth.id, 'invitations', page, status, debouncedSearch], queryFn: () => getBetaInvitationPage({ page, status, search: debouncedSearch }), enabled: Boolean(auth.id), staleTime: 60000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<string | null>(null);
  const generating = useRef(false);
  async function generate() {
    if (generating.current) return;
    generating.current = true; setBusy(true); setError(''); setNotice('');
    request.current ??= crypto.randomUUID();
    try {
      const { data, error: failure } = await generateBetaInvitation(request.current);
      if (failure || !data?.[0]) throw new Error(failure?.message || 'No se confirmó la generación del código.');
      request.current = null;
      setNotice(`Código generado: ${data[0].code}`);
      setPage(0); setStatus('all'); setSearch(''); setDebouncedSearch('');
      await client.invalidateQueries({ queryKey: ['admin'] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo generar el código.'); }
    finally { generating.current = false; setBusy(false); }
  }
  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); setNotice(`Copiado: ${code}`); }
    catch { setError('No se pudo copiar automáticamente. Selecciona el código y cópialo.'); }
  }
  const rows = query.data?.rows || [];
  const total = query.data?.total ?? 0;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Códigos de invitación</h2><p className="mt-1 text-sm text-on-surface-card-secondary">Cada código permite un registro. El siguiente número se asigna al generarlo.</p></div><button type="button" onClick={() => void generate()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16}/>{busy ? 'Generando…' : 'Generar código'}</button></div>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle bg-surface-card p-4">
      <label className="relative flex-1 min-w-44"><Search size={16} className="absolute left-3 top-3 text-on-surface-card-secondary"/><input aria-label="Buscar código de invitación" placeholder="Buscar código KYO-TEST…" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl border border-border-subtle bg-surface-input py-2.5 pl-9 pr-3 text-sm" /></label>
      <select aria-label="Estado del código" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(0); }} className="rounded-xl border border-border-subtle bg-surface-input p-2.5 text-sm"><option value="all">Todos los códigos</option><option value="available">Disponibles</option><option value="used">Utilizados</option></select>
      <button type="button" aria-label="Actualizar códigos" disabled={query.isFetching} onClick={() => void query.refetch()} className="rounded-xl border border-border-subtle p-2.5 disabled:opacity-50"><RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''}/></button>
    </div>
    {notice && <p role="status" className="select-text rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {(error || query.error) && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error || query.error?.message}</p>}
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-border-subtle bg-surface-raised/40 text-xs text-on-surface-card-secondary"><tr><th className="p-4 font-medium">Código</th><th className="p-4 font-medium">Estado</th><th className="p-4 font-medium">Correo asignado</th><th className="p-4 font-medium">Creado</th><th className="p-4 font-medium">Acción</th></tr></thead><tbody>
      {query.isLoading ? <tr><td colSpan={5} className="p-8 text-center text-on-surface-card-secondary">Cargando códigos…</td></tr> : !rows.length ? <tr><td colSpan={5} className="p-8 text-center text-on-surface-card-secondary">{query.isError ? 'No se pudieron cargar los códigos.' : 'No hay códigos para estos filtros.'}</td></tr> : rows.map(row => <tr key={row.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-raised/30"><td className="p-4"><code className="select-text font-semibold">{row.code}</code></td><td className="p-4"><span className={`rounded-lg px-2 py-1 text-xs ${row.is_used ? 'bg-surface-raised text-on-surface-card-secondary' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>{row.is_used ? 'Utilizado' : 'Disponible'}</span></td><td className="p-4 text-on-surface-card-secondary">{row.recipient_email || 'Sin correo asignado'}</td><td className="p-4 text-xs text-on-surface-card-secondary">{new Date(row.created_at).toLocaleDateString('es-CL')}</td><td className="p-4"><button type="button" aria-label={`Copiar ${row.code}`} onClick={() => void copy(row.code)} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-xs hover:bg-surface-raised"><Copy size={13}/>Copiar</button></td></tr>)}
    </tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-card-secondary"><span>{total} códigos · Página {page + 1} de {Math.max(1, Math.ceil(total / 25))}</span><div className="flex gap-2"><button disabled={page === 0 || query.isFetching} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-40">Anterior</button><button disabled={(page + 1) * 25 >= total || query.isFetching} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-border-subtle px-3 py-2 disabled:opacity-40">Siguiente</button></div></div>
  </section>;
}
