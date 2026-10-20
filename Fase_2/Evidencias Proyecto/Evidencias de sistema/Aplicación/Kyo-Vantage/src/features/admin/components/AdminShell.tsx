import type { AuthSnapshot } from '@/features/auth/model/auth';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
export function AdminShell({ auth, children }: { auth: AuthSnapshot; children: React.ReactNode }) {
  return <div className="min-h-screen bg-app-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-app-background">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-7">
        <Link to="/admin" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary dark:text-purple-300"><ShieldCheck size={21} /></span><span className="font-semibold tracking-tight">Kyo Vantage<span className="ml-2 rounded-md border border-border-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-card-secondary">Admin</span></span></Link>
        <div className="flex items-center gap-4"><div className="hidden text-right sm:block"><p className="max-w-64 truncate text-xs font-medium">{auth.email}</p><p className="mt-0.5 text-[10px] uppercase tracking-wider text-on-surface-card-secondary">{auth.role === 'superadmin' ? 'Superadministrador' : 'Administrador'}</p></div><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-3 py-2 text-xs font-medium hover:bg-surface-raised"><ArrowLeft size={14} />Volver a la app</Link></div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-7 md:py-8">{children}</main>
  </div>;
}
