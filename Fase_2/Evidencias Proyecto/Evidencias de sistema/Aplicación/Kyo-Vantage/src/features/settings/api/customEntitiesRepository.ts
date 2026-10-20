import { createClient } from "@/utils/supabase/client";
import { createNotification } from "@/features/notifications/api/notificationRepository";

export interface CustomBank {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  type: 'expense' | 'income';
  icon_name: string;
  created_at: string;
}

// ==============================
// BANKS
// ==============================

export const getUserCustomBanks = async (): Promise<CustomBank[]> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_custom_banks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching custom banks:', error);
    return [];
  }
  return data as CustomBank[];
};

export const addUserCustomBank = async (name: string, color: string = '#534AB7'): Promise<CustomBank | null> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verificar límite de 5
  const currentBanks = await getUserCustomBanks();
  if (currentBanks.length >= 5) {
    throw new Error("Has alcanzado el límite máximo de 5 bancos personalizados.");
  }

  const { data, error } = await supabase
    .from('user_custom_banks')
    .insert([{ user_id: user.id, name, color }])
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'creation',
    title: 'Banco Creado',
    message: `Has añadido tu banco personalizado "${name}".`
  });

  return data as CustomBank;
};

export const updateUserCustomBank = async (id: string, updates: Partial<CustomBank>): Promise<CustomBank> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_custom_banks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'system',
    title: 'Banco Actualizado',
    message: `Has modificado tu banco personalizado "${updates.name || 'seleccionado'}".`
  });

  return data as CustomBank;
};

export const deleteUserCustomBank = async (id: string): Promise<void> => {
  // El esquema actual de staging no tiene user_custom_banks y las cuentas /
  // tarjetas ya no tienen bank_id. No intentamos ejecutar la operación vieja.
  void id;
  throw new Error('Staging aún no soporta bancos personalizados; usa uno de los bancos configurados por Infraestructura.');
};

// ==============================
// CATEGORIES
// ==============================

export const getUserCustomCategories = async (): Promise<CustomCategory[]> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return data as CustomCategory[];
};

export const addUserCustomCategory = async (name: string, type: 'expense' | 'income', icon_name: string = 'Tag'): Promise<CustomCategory | null> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verificar límite de 8
  const currentCategories = await getUserCustomCategories();
  if (currentCategories.length >= 8) {
    throw new Error("Has alcanzado el límite máximo de 8 categorías personalizadas.");
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([{ user_id: user.id, name: name.trim(), type, icon_name }])
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'creation',
    title: 'Categoría Creada',
    message: `Has creado la categoría personalizada "${name}".`
  });

  return data as CustomCategory;
};

export const updateUserCustomCategory = async (id: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon_name'>>): Promise<CustomCategory> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No has iniciado sesión.');
  const payload = { ...(updates.name !== undefined ? { name: updates.name.trim() } : {}), ...(updates.icon_name !== undefined ? { icon_name: updates.icon_name } : {}) };
  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('user_id', user.id)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await createNotification({
    type: 'system',
    title: 'Categoría Actualizada',
    message: `Has modificado la categoría personalizada "${updates.name || 'seleccionada'}".`
  });

  return data as CustomCategory;
};

export const deleteUserCustomCategory = async (id: string): Promise<void> => {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No has iniciado sesión.');
  // Las FK protegen el historial: nunca borrar presupuestos ni reclasificar movimientos.
  const { data, error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id).select('id').single();
  if (error?.code === '23503') throw new Error('Esta categoría está en uso. Conserva sus movimientos y presupuestos; puedes cambiarle el nombre o el icono.');
  if (error) throw error;
  if (!data) throw new Error('No se encontró la categoría.');

  await createNotification({
    type: 'system',
    title: 'Categoría Eliminada',
    message: `Has eliminado una categoría personalizada.`
  });
};
