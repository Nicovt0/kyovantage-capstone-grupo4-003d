import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import type { AuthSnapshot } from '@/features/auth/model/auth';
import { queryClient } from '@/lib/queryClient';

export function AppProviders({
  children,
  initialAuth,
}: {
  children: React.ReactNode;
  initialAuth?: AuthSnapshot | null;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialAuth={initialAuth}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
