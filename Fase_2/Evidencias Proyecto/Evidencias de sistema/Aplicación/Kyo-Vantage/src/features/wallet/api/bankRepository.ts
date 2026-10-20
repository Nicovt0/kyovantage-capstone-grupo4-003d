import { Bank } from "@/types";
import { banksDb } from '@/mockdata/banks';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";
import { mapBankRow } from './bankTemplateRepository';

export const getBanks = async (): Promise<Bank[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...banksDb]), 50);
    });
  }

  const supabase = createClient();

  // Intenta refrescar la sesión si el token expiró
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    // No hay sesión activa — devuelve vacío silenciosamente
    return [];
  }

  // Staging usa bancos globales. Los antiguos user_custom_banks no existen en
  // el esquema actual y no deben bloquear la carga del selector.
  const { data: globalBanks, error: globalError } = await supabase
    .from('banks')
    .select('id, name, logo_url, primary_color, is_active')
    .eq('is_active', true)
    .order('name');

  if (globalError) {
    // JWT expirado u otro error de auth → intenta refrescar
    if (globalError.code === 'PGRST303' || globalError.message?.includes('JWT')) {
      await supabase.auth.refreshSession();
      const { data: retryBanks } = await supabase
        .from('banks')
        .select('id, name, logo_url, primary_color, is_active')
        .eq('is_active', true)
        .order('name');
      return retryBanks ? retryBanks.map(mapBankRow) : [];
    }
    console.error('Error fetching global banks:', globalError);
    return [];
  }

  return (globalBanks || []).map(mapBankRow);
};

