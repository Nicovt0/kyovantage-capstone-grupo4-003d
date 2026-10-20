export const APP_ROLES = ['user', 'admin', 'superadmin'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function getRoleFromUser(user: { app_metadata?: Record<string, unknown> } | null | undefined): AppRole {
  const role = user?.app_metadata?.role;
  return isAppRole(role) ? role : 'user';
}

export function isDevelopmentEnvironment(): boolean {
  return import.meta.env?.VITE_APP_ENV === 'development';
}

export function canAccessAdmin(role: AppRole): boolean {
  return role === 'admin' || (role === 'superadmin' && isDevelopmentEnvironment());
}

export function canManageRoles(role: AppRole): boolean {
  return role === 'superadmin' && isDevelopmentEnvironment();
}
