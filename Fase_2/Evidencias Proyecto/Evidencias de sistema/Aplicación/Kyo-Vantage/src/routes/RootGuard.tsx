import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { createClient } from '@/utils/supabase/client';
import { AuthLogo } from '@/features/auth/components/AuthLogo';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';

interface RootGuardProps {
  children?: React.ReactNode;
}

export function RootGuard({ children }: RootGuardProps) {
  const location = useLocation();
  const supabase = createClient();

  const [loading, setLoading] = useState(!USE_MOCKS);
  const [isAuthenticated, setIsAuthenticated] = useState(USE_MOCKS);

  useEffect(() => {
    if (USE_MOCKS) {
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setIsAuthenticated(Boolean(session?.user));
          setLoading(false);
        }
      } catch (error) {
        console.error('RootGuard session check error:', error);
        if (isMounted) {
          setIsAuthenticated(false);
          setLoading(false);
        }
      }
    }

    void checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setIsAuthenticated(Boolean(session?.user));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Pantalla de carga oscura (sin flash de contenido no autenticado ni pantallas en blanco)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#06040d] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#6d28d9]/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="z-10 flex flex-col items-center gap-6 animate-pulse">
          <AuthLogo />
          <div className="flex items-center gap-3 text-xs text-gray-400 tracking-wider uppercase font-semibold">
            <div className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-ping" />
            Verificando sesión...
          </div>
        </div>
      </div>
    );
  }

  // Redirección si no hay sesión activa
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
