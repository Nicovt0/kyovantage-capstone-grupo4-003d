import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';

export interface AdminAuthState {
  isAdmin: boolean;
  isLoading: boolean;
  user: any | null;
  role: string;
  error: string | null;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    isLoading: true,
    user: null,
    role: 'user',
    error: null,
  });

  const checkAdminStatus = useCallback(async () => {
    if (USE_MOCKS) {
      setState({
        isAdmin: true,
        isLoading: false,
        user: { id: 'mock-admin-id', email: 'admin@kyovantage.cl' },
        role: 'admin',
        error: null,
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setState({
          isAdmin: false,
          isLoading: false,
          user: null,
          role: 'guest',
          error: sessionError ? sessionError.message : 'No active session',
        });
        return;
      }

      const user = session.user;
      let userRole = 'user';
      let isAdminUser = false;

      // 1. Check app_metadata / user_metadata
      const appRole = user.app_metadata?.role || user.user_metadata?.role;
      if (appRole === 'admin' || appRole === 'superadmin') {
        userRole = String(appRole);
        isAdminUser = true;
      }

      // 2. Query profiles table for role or is_admin flag
      if (!isAdminUser) {
        const { data: profile, error: profileErr } = await (supabase
          .from('profiles') as any)
          .select('role, is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) {
          console.warn('Could not fetch user profile for admin check:', profileErr);
        }

        if (profile) {
          if (profile.role === 'admin' || profile.role === 'superadmin' || profile.is_admin === true) {
            userRole = profile.role || 'admin';
            isAdminUser = true;
          }
        }
      }

      setState({
        isAdmin: isAdminUser,
        isLoading: false,
        user,
        role: userRole,
        error: null,
      });
    } catch (err: any) {
      console.error('useAdminAuth check failed:', err);
      setState({
        isAdmin: false,
        isLoading: false,
        user: null,
        role: 'guest',
        error: err.message || 'Error validating admin session',
      });
    }
  }, []);

  useEffect(() => {
    void checkAdminStatus();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void checkAdminStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  return { ...state, refetch: checkAdminStatus };
}
