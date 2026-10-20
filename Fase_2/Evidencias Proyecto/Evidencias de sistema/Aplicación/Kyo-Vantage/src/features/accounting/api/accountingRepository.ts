import { createClient } from '@/utils/supabase/client';

/** All financial effects commit or roll back together in PostgreSQL. No client-side fallback. */
export async function accountingMutation<T>(operation: string, payload: object, requestId: string = crypto.randomUUID()): Promise<T> {
  const { data, error } = await createClient().rpc('accounting_mutate', {
    p_operation: operation,
    p_payload: payload,
    p_request_id: requestId,
  });
  if (error) {
    if (['PGRST202', '42883'].includes(error.code)) {
      throw new Error('Este entorno necesita la migración de contabilidad atómica antes de registrar movimientos.');
    }
    throw new Error(error.message || 'No se pudo confirmar la operación contable.');
  }
  if (data === null) throw new Error('El servidor no confirmó la operación contable.');
  return data as T;
}
