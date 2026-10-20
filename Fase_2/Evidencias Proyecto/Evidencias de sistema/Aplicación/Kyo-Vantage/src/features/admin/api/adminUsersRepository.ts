import { createClient } from '../../../utils/supabase/client.ts';
import { USE_MOCKS } from '../../../shared/lib/serviceConfig.ts';

export type UserRole = 'user' | 'admin' | 'superadmin';

export interface AdminUserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetAllUsersAdminParams {
  search?: string;
  roleFilter?: 'all' | UserRole;
  limit?: number;
  page?: number;
}

export interface GetAllUsersAdminResult {
  users: AdminUserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// In-memory mock store for test and development modes
export const mockAdminUsers: AdminUserProfile[] = [
  {
    id: 'mock-admin-id',
    email: 'admin@kyovantage.cl',
    full_name: 'Administrador Principal',
    role: 'superadmin',
    is_admin: true,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mock-user-1',
    email: 'nicolas@ejemplo.com',
    full_name: 'Nicolás Valenzuela',
    role: 'user',
    is_admin: false,
    is_active: true,
    created_at: '2026-02-15T10:30:00Z',
    updated_at: '2026-02-15T10:30:00Z',
  },
  {
    id: 'mock-user-2',
    email: 'carolina.demo@gmail.com',
    full_name: 'Carolina Tapia',
    role: 'user',
    is_admin: false,
    is_active: true,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
  },
  {
    id: 'mock-user-3',
    email: 'matias.auditor@kyovantage.cl',
    full_name: 'Matías Silva',
    role: 'admin',
    is_admin: true,
    is_active: true,
    created_at: '2026-03-10T14:20:00Z',
    updated_at: '2026-03-10T14:20:00Z',
  },
  {
    id: 'mock-user-4',
    email: 'rodrigo.test@outlook.com',
    full_name: 'Rodrigo Fuentes',
    role: 'user',
    is_admin: false,
    is_active: false,
    created_at: '2026-03-20T09:15:00Z',
    updated_at: '2026-03-25T11:00:00Z',
  },
];

/**
 * Retrieves a paginated list of user profiles for administration & moderation.
 */
export async function getAllUsersAdmin(
  params: GetAllUsersAdminParams = {}
): Promise<GetAllUsersAdminResult> {
  const { search = '', roleFilter = 'all', limit = 10, page = 1 } = params;
  const safeLimit = Math.max(1, limit);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  if (USE_MOCKS) {
    let filtered = [...mockAdminUsers];
    if (roleFilter && roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.full_name && u.full_name.toLowerCase().includes(q))
      );
    }
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + safeLimit);
    return {
      users: paginated,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  const supabase = createClient();
  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, is_admin, is_active, created_at, updated_at', { count: 'exact' });

  if (roleFilter && roleFilter !== 'all') {
    query = query.eq('role', roleFilter);
  }

  if (search.trim()) {
    const q = search.trim().replace(/[%_\\]/g, '\\$&');
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + safeLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[getAllUsersAdmin] Error:', error);
    throw new Error(`Error al obtener usuarios: ${error.message}`);
  }

  const users: AdminUserProfile[] = (data || []).map((row: any) => ({
    id: row.id,
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    role: (row.role as UserRole) || 'user',
    is_admin: Boolean(row.is_admin || row.role === 'admin' || row.role === 'superadmin'),
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const total = count ?? users.length;

  return {
    users,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * Updates a user's role and admin privileges under strict validation.
 */
export async function updateUserRoleAdmin(
  userId: string,
  newRole: 'user' | 'admin' | 'superadmin',
  isAdmin: boolean
): Promise<AdminUserProfile> {
  if (!userId) {
    throw new Error('ID de usuario requerido');
  }
  const validRoles: UserRole[] = ['user', 'admin', 'superadmin'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Rol inválido: ${newRole}`);
  }

  if (USE_MOCKS) {
    const user = mockAdminUsers.find((u) => u.id === userId);
    if (!user) throw new Error('Usuario no encontrado');
    user.role = newRole;
    user.is_admin = isAdmin;
    user.updated_at = new Date().toISOString();
    return { ...user };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      is_admin: isAdmin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, email, full_name, role, is_admin, is_active, created_at, updated_at')
    .single();

  if (error) {
    console.error('[updateUserRoleAdmin] Error:', error);
    throw new Error(`Error al actualizar rol de usuario: ${error.message}`);
  }

  return {
    id: data.id,
    email: data.email ?? null,
    full_name: data.full_name ?? null,
    role: (data.role as UserRole) || 'user',
    is_admin: Boolean(data.is_admin),
    is_active: data.is_active !== false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Toggles a user's active/suspended status in the platform.
 */
export async function toggleUserActiveStatusAdmin(
  userId: string,
  isActive: boolean
): Promise<AdminUserProfile> {
  if (!userId) {
    throw new Error('ID de usuario requerido');
  }

  if (USE_MOCKS) {
    const user = mockAdminUsers.find((u) => u.id === userId);
    if (!user) throw new Error('Usuario no encontrado');
    user.is_active = isActive;
    user.updated_at = new Date().toISOString();
    return { ...user };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, email, full_name, role, is_admin, is_active, created_at, updated_at')
    .single();

  if (error) {
    console.error('[toggleUserActiveStatusAdmin] Error:', error);
    throw new Error(`Error al cambiar estado del usuario: ${error.message}`);
  }

  return {
    id: data.id,
    email: data.email ?? null,
    full_name: data.full_name ?? null,
    role: (data.role as UserRole) || 'user',
    is_admin: Boolean(data.is_admin),
    is_active: data.is_active !== false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
