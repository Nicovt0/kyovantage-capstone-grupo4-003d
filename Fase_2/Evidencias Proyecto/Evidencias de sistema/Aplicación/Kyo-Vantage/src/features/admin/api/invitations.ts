import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

// Local migration contract, isolated until a complete generated schema is present.
type InvitationDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      beta_code_available: { Args: { p_code: string; p_email?: string }; Returns: boolean };
      approve_waitlist_request: { Args: { p_id: string }; Returns: string };
      reject_waitlist_request: { Args: { p_id: string }; Returns: undefined };
      join_waitlist: { Args: { p_email: string }; Returns: undefined };
      generate_beta_invitation: { Args: { p_request_id: string }; Returns: BetaInvitation[] };
    };
  };
};

export interface BetaInvitation {
  id: string;
  code: string;
  is_used: boolean;
  recipient_email: string | null;
  created_at: string;
}

export async function joinWaitlist(email: string) {
  const { error } = await invitationClient().rpc('join_waitlist', { p_email: email.trim().toLowerCase() });
  if (error) throw new Error('No pudimos guardar tu solicitud. Inténtalo nuevamente.');
}

export function generateBetaInvitation(requestId: string) {
  return invitationClient().rpc('generate_beta_invitation', { p_request_id: requestId });
}

export async function getBetaInvitations() {
  const { data, error } = await createClient().from('beta_invitations').select('id,code,is_used,recipient_email,created_at').order('created_at', { ascending: false }).limit(25);
  if (error) throw new Error(`No se pudieron cargar los códigos: ${error.message}`);
  return (data || []) as BetaInvitation[];
}

function invitationClient() {
  return createClient() as unknown as SupabaseClient<InvitationDatabase>;
}

export function betaCodeAvailable(code: string, email?: string) {
  return invitationClient().rpc('beta_code_available', {
    p_code: code.trim().toUpperCase(),
    ...(email === undefined ? {} : { p_email: email.trim().toLowerCase() }),
  });
}

export function approveWaitlistRequest(id: string) {
  return invitationClient().rpc('approve_waitlist_request', { p_id: id });
}

export function rejectWaitlistRequest(id: string) {
  return invitationClient().rpc('reject_waitlist_request', { p_id: id });
}


export async function getBetaInvitationPage({ page = 0, status = 'all', search = '' }: { page?: number; status?: 'all' | 'available' | 'used'; search?: string } = {}) {
  const safePage = Math.max(0, Math.floor(page));
  let query = createClient().from('beta_invitations').select('id,code,is_used,recipient_email,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(safePage * 25, safePage * 25 + 24);
  if (status === 'available') query = query.or('is_used.is.null,is_used.eq.false');
  if (status === 'used') query = query.eq('is_used', true);
  if (search.trim()) query = query.ilike('code', `%${search.trim().replace(/[%_\\]/g, '\\$&')}%`);
  const { data, error, count } = await query;
  if (error) throw new Error(`No se pudieron cargar los códigos: ${error.message}`);
  return { rows: (data || []) as BetaInvitation[], total: count ?? 0 };
}
