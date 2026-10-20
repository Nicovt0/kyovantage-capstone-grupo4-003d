import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // [SP2-09] Los datos se consideran "frescos" por 5 minutos:
      // Evita llamadas repetidas a Supabase al alternar entre /wallet, /dashboard, /agenda
      staleTime: 1000 * 60 * 5, // 5 minutos
      // Mantiene datos en memoria RAM por 30 minutos aunque el componente se desmonte (gcTime > staleTime)
      gcTime: 1000 * 60 * 30, // 30 minutos
      // Al volver a una pantalla, refresca datos únicamente si están stale o fueron invalidados por mutación
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});
