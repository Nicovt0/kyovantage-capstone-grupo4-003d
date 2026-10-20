import { Category } from "@/types";
import { categoriesDb } from '@/mockdata/categories';
import { USE_MOCKS } from '@/shared/lib/serviceConfig';
import { createClient } from "@/utils/supabase/client";

export const getCategories = async (): Promise<Category[]> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...categoriesDb]), 50);
    });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from('categories').select('*');
  query = user ? query.or(`user_id.is.null,user_id.eq.${user.id}`) : query.is('user_id', null);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  const finalCategories = (data || []) as Category[];

  // Filtrar la categoría del sistema "Saldo Inicial" para que no le aparezca al usuario
  return finalCategories.filter(c => c.name !== 'Saldo Inicial');
};

export const getCategoryById = async (id: string): Promise<Category | undefined> => {
  if (USE_MOCKS) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(categoriesDb.find(c => c.id === id)), 50);
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();
  if (error) throw error;
  return data || undefined;
};
