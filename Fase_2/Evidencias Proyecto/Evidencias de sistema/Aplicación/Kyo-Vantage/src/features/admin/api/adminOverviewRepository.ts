import { createClient } from '@/utils/supabase/client';

export interface AdminOverview {
  users: number;
  pendingRequests: number;
  availableCodes: number;
  usedCodes: number;
  activeBanks: number;
  accountTemplates: number;
  cardTemplates: number;
  recentRequests: { id: string; email: string; status: string; created_at: string }[];
  recentUsers: { id: string; full_name: string | null; created_at: string }[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const client = createClient();
  const responses = await Promise.all([
    client.from('profiles').select('id', { count: 'exact', head: true }),
    client.from('waitlist').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('beta_invitations').select('id', { count: 'exact', head: true }).or('is_used.is.null,is_used.eq.false'),
    client.from('beta_invitations').select('id', { count: 'exact', head: true }).eq('is_used', true),
    client.from('banks').select('id', { count: 'exact', head: true }).eq('is_active', true),
    client.from('bank_account_templates').select('id', { count: 'exact', head: true }),
    client.from('bank_credit_card_templates').select('id', { count: 'exact', head: true }),
    client.from('waitlist').select('id,email,status,created_at').order('created_at', { ascending: false }).limit(5),
    client.from('profiles').select('id,full_name,created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  const names = ['usuarios', 'solicitudes', 'códigos disponibles', 'códigos utilizados', 'bancos', 'plantillas de cuenta', 'plantillas de tarjeta', 'solicitudes recientes', 'registros recientes'];
  responses.forEach((result, index) => { if (result.error) throw new Error(`No se pudo cargar ${names[index]}: ${result.error.message}`); });
  const count = (index: number) => {
    const value = responses[index].count;
    if (value === null || value === undefined) throw new Error(`No se confirmó el total de ${names[index]}.`);
    return value;
  };
  return { users: count(0), pendingRequests: count(1), availableCodes: count(2), usedCodes: count(3), activeBanks: count(4), accountTemplates: count(5), cardTemplates: count(6), recentRequests: responses[7].data || [], recentUsers: responses[8].data || [] } as AdminOverview;
}
