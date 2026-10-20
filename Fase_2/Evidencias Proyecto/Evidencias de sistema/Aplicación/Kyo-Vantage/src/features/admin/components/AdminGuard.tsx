import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { AuthSnapshot } from '@/features/auth/model/auth';
import { authSnapshotFromUser } from '@/features/auth/model/auth';
import { canAccessAdmin } from '@/types/roles';
import { createClient } from '@/utils/supabase/client';
import { AdminShell } from './AdminShell';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; auth: AuthSnapshot | null; error: boolean }>({ loading: true, auth: null, error: false });
  useEffect(() => {
    let alive = true;
    const client = createClient();
    const verify = async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (alive) setState({ loading: false, auth: data.user ? authSnapshotFromUser(data.user) : null, error: Boolean(error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) });
      } catch {
        if (alive) setState({ loading: false, auth: null, error: true });
      }
    };
    void verify();
    const { data: { subscription } } = client.auth.onAuthStateChange(() => {
      setTimeout(() => { if (alive) void verify(); }, 0);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  if (state.loading) return <p className="p-8 text-foreground">Verificando acceso administrativo…</p>;
  if (state.error) return <div className="p-8 text-foreground">No se pudo verificar tu acceso. <Link to="/dashboard">Volver</Link></div>;
  if (!state.auth) return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  if (!canAccessAdmin(state.auth.role)) return <Navigate to="/dashboard" replace />;
  return <AdminShell auth={state.auth}>{children}</AdminShell>;
}
