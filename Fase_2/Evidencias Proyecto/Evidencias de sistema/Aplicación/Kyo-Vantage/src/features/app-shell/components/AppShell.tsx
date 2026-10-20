import { FinancialPeriodProvider } from './FinancialPeriodProvider';
import { useFinancialSettings } from '@/features/settings/hooks/useFinancialSettings';
import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { SideNav } from '@/features/app-shell/components/layout/SideNav';
import { TopNav } from '@/features/app-shell/components/layout/TopNav';
import { BottomNav } from '@/features/app-shell/components/layout/BottomNav';
import { prefetchCriticalRoutes } from '@/lib/prefetchRoutes';
import { useRealtimeSync } from '@/features/app-shell/hooks/useRealtimeSync';

export function AppShell({ children }: { children?: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const financialSettings = useFinancialSettings();

  // Active Realtime accounting & balance synchronization
  useRealtimeSync();

  useEffect(() => {
    // [SP2-09] Anticipatory prefetch of critical routes on idle
    if (typeof window === 'undefined') return;

    const runIdlePrefetch = () => {
      void prefetchCriticalRoutes(queryClient, auth?.id);
    };

    if ('requestIdleCallback' in window) {
      const handle = (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(runIdlePrefetch);
      return () => {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle);
      };
    } else {
      const timer = setTimeout(runIdlePrefetch, 600);
      return () => clearTimeout(timer);
    }
  }, [queryClient, auth?.id]);

  return (
    <FinancialPeriodProvider key={auth.id}><div className="min-h-screen bg-app-background">
      <SideNav />
      <div className="flex min-h-[101vh] w-full flex-1 flex-col transition-all duration-300 md:pl-[260px]">
        <Suspense fallback={<div className="h-16" />}>
          <TopNav />
        </Suspense>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          {financialSettings.isError ? <div role="alert" className="p-6 text-center"><p>{financialSettings.error.message}</p><button onClick={() => void financialSettings.refetch()} className="mt-3 rounded-xl bg-brand-primary p-3 text-white">Reintentar</button></div> : !financialSettings.data ? <p role="status" className="p-6 text-center">Cargando tu mes financiero…</p> : (children || <Outlet />)}
        </main>
        <BottomNav />
      </div>
    </div></FinancialPeriodProvider>
  );
}
