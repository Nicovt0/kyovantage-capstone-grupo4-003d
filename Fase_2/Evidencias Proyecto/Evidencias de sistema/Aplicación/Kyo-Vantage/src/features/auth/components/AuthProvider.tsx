import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import {
  authSnapshotFromSession,
  type AuthSnapshot,
} from '@/features/auth/model/auth';

type AuthContextValue = {
  auth: AuthSnapshot;
  signOut: (destination?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultAuth: AuthSnapshot = {
  id: '',
  email: '',
  displayName: 'Usuario',
  role: 'user',
};

export function AuthProvider({
  children,
  initialAuth,
}: {
  children: React.ReactNode;
  initialAuth?: AuthSnapshot | null;
}) {
  const [auth, setAuth] = useState<AuthSnapshot>(initialAuth ?? defaultAuth);
  const activeUserId = useRef(auth.id);
  const signOutDestination = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const clearPrivateState = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  const navigateAfterSignOut = useCallback((destination: string) => {
    if (/^https?:\/\//i.test(destination)) {
      window.location.assign(destination);
      return;
    }

    navigateRef.current(destination, { replace: true });
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Check session initially
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentAuth = authSnapshotFromSession(session);
      if (currentAuth) {
        setAuth(prev => {
          if (
            prev.id === currentAuth.id &&
            prev.email === currentAuth.email &&
            prev.displayName === currentAuth.displayName &&
            prev.role === currentAuth.role
          ) {
            return prev;
          }
          return currentAuth;
        });
        activeUserId.current = currentAuth.id;
      }
    });

    const handleAuthChange = (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigateRef.current('/actualizar-password', { replace: true });
        return;
      }

      const nextAuth = authSnapshotFromSession(session);
      if (!nextAuth) {
        if (event === 'SIGNED_OUT') {
          clearPrivateState();
          const destination = signOutDestination.current ?? '/login';
          signOutDestination.current = null;
          navigateAfterSignOut(destination);
        } else {
          setAuth(defaultAuth);
        }
        return;
      }

      if (activeUserId.current !== nextAuth.id) {
        clearPrivateState();
        activeUserId.current = nextAuth.id;
      }

      setAuth(prev => {
        if (
          prev.id === nextAuth.id &&
          prev.email === nextAuth.email &&
          prev.displayName === nextAuth.displayName &&
          prev.role === nextAuth.role
        ) {
          return prev;
        }
        return nextAuth;
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
    return () => subscription.unsubscribe();
  }, [clearPrivateState, navigateAfterSignOut]);

  const signOut = useCallback(async (destination = '/login') => {
    signOutDestination.current = destination;
    clearPrivateState();
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    if (signOutDestination.current) {
      signOutDestination.current = null;
      navigateAfterSignOut(destination);
    }
  }, [clearPrivateState, navigateAfterSignOut]);

  const value = useMemo(() => ({ auth, signOut }), [auth, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      auth: defaultAuth,
      signOut: async () => {},
    };
  }
  return context;
}
