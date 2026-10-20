import { canManageRoles } from '@/types/roles';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Button } from '@heroui/react';
import { useAuth } from '@/features/auth/components/AuthProvider';
import {
  useAdminUsers,
  useUpdateUserRole,
  useToggleUserActiveStatus,
} from '@/features/admin/hooks/useAdminUsers';
import { AdminUserProfile, UserRole } from '@/features/admin/api/adminUsersRepository';

export function AdminUsersTab() {
  const { auth } = useAuth();
  const currentUserId = auth?.id;
  const roleEditingAllowed = canManageRoles(auth.role);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAdminUsers({
    search: debouncedSearch,
    roleFilter,
    page,
    limit,
  });

  const updateRoleMutation = useUpdateUserRole();
  const toggleStatusMutation = useToggleUserActiveStatus();

  // Modal State for Role Change
  const [selectedUserForRole, setSelectedUserForRole] = useState<AdminUserProfile | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('user');
  const [roleModalError, setRoleModalError] = useState<string | null>(null);
  const [roleModalSuccess, setRoleModalSuccess] = useState<string | null>(null);

  // Status Change Confirmation Modal
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<AdminUserProfile | null>(null);
  const [statusModalError, setStatusModalError] = useState<string | null>(null);

  const openRoleModal = (user: AdminUserProfile) => {
    setSelectedUserForRole(user);
    setSelectedNewRole(user.role);
    setRoleModalError(null);
    setRoleModalSuccess(null);
  };

  const closeRoleModal = () => {
    setSelectedUserForRole(null);
    setRoleModalError(null);
    setRoleModalSuccess(null);
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedUserForRole || !roleEditingAllowed) return;
    setRoleModalError(null);
    setRoleModalSuccess(null);

    const isAdmin = selectedNewRole === 'admin' || selectedNewRole === 'superadmin';

    try {
      await updateRoleMutation.mutateAsync({
        userId: selectedUserForRole.id,
        newRole: selectedNewRole,
        isAdmin,
      });
      setRoleModalSuccess(`Rol de ${selectedUserForRole.email || 'usuario'} actualizado a ${selectedNewRole}.`);
      setTimeout(() => {
        closeRoleModal();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar rol';
      setRoleModalError(msg);
    }
  };

  const openStatusModal = (user: AdminUserProfile) => {
    setSelectedUserForStatus(user);
    setStatusModalError(null);
  };

  const closeStatusModal = () => {
    setSelectedUserForStatus(null);
    setStatusModalError(null);
  };

  const handleConfirmStatusToggle = async () => {
    if (!selectedUserForStatus) return;
    setStatusModalError(null);
    const newActiveState = !selectedUserForStatus.is_active;

    try {
      await toggleStatusMutation.mutateAsync({
        userId: selectedUserForStatus.id,
        isActive: newActiveState,
      });
      closeStatusModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      setStatusModalError(msg);
    }
  };

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Superadmin</span>
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-kyo-lightPurple/20 text-kyo-lightPurple border border-kyo-lightPurple/30">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
            <Users className="w-3.5 h-3.5" />
            <span>Usuario</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Activo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        Suspendido
      </span>
    );
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-kyo-lightPurple" />
            Gestión y Moderación de Usuarios
          </h2>
          <p className="mt-1 text-sm text-on-surface-card-secondary">
            Administra roles, privilegios de acceso y estado activo de los perfiles en Kyo Vantage.
          </p>
        </div>
        <Button
          size="sm"
          variant="flat"
          onPress={() => void refetch()}
          disabled={isFetching}
          className="bg-surface-raised/50 hover:bg-surface-raised text-on-surface-card-secondary hover:text-foreground border border-border-subtle self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-2xl bg-surface-card border border-border-subtle">
        {/* Search */}
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-on-surface-card-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por correo o nombre completo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-input border border-border-subtle text-sm text-foreground placeholder-[#71717a] focus:outline-none focus:border-kyo-lightPurple/50 focus:ring-1 focus:ring-kyo-lightPurple/50 transition-all"
          />
        </div>

        {/* Role Filter */}
        <div className="sm:col-span-4">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as 'all' | UserRole);
              setPage(1);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-input border border-border-subtle text-sm text-foreground focus:outline-none focus:border-kyo-lightPurple/50 transition-all cursor-pointer"
          >
            <option value="all">Todos los roles</option>
            <option value="user">Solo Usuarios</option>
            <option value="admin">Solo Administradores</option>
            <option value="superadmin">Solo Superadministradores</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error instanceof Error ? error.message : 'Error al cargar usuarios'}</span>
          </div>
          <Button size="sm" variant="light" onPress={() => void refetch()} className="text-rose-300">
            Reintentar
          </Button>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden shadow-card-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-raised/40 text-on-surface-card-secondary text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Usuario</th>
                <th className="py-3.5 px-4">Correo Electrónico</th>
                <th className="py-3.5 px-4">Rol</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Registro</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {isLoading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 w-32 bg-surface-raised rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-40 bg-surface-raised rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 w-20 bg-surface-raised rounded-full" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-6 w-16 bg-surface-raised rounded-full" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-surface-raised rounded" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-8 w-24 bg-surface-raised rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-card-secondary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserX className="w-8 h-8 opacity-40 text-kyo-lightPurple" />
                      <p className="font-medium">No se encontraron usuarios</p>
                      <p className="text-xs text-on-surface-card-secondary">Prueba ajustando los filtros o término de búsqueda.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const formattedDate = user.created_at
                    ? new Date(user.created_at).toLocaleDateString('es-CL', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-surface-raised/40 transition-colors"
                    >
                      {/* Name & Initials */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-kyo-lightPurple/20 border border-kyo-lightPurple/30 flex items-center justify-center text-kyo-lightPurple font-bold text-xs uppercase shadow-sm">
                            {user.full_name
                              ? user.full_name.slice(0, 2)
                              : user.email
                              ? user.email.slice(0, 2)
                              : 'US'}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{user.full_name || 'Sin nombre'}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-surface-raised text-on-surface-card-body px-1.5 py-0.5 rounded font-normal">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-on-surface-card-secondary font-mono truncate max-w-[120px]">
                              {user.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 text-on-surface-card-secondary font-mono text-xs">
                        {user.email || 'Sin correo asociado'}
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        {renderRoleBadge(user.role)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {renderStatusBadge(user.is_active)}
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 text-on-surface-card-secondary text-xs">
                        {formattedDate}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => openRoleModal(user)}
                            isDisabled={!roleEditingAllowed}
                            title={roleEditingAllowed ? 'Cambiar rol' : 'Disponible para superadministradores en staging'}
                            className="bg-kyo-lightPurple/15 hover:bg-kyo-lightPurple/25 text-kyo-lightPurple font-medium text-xs rounded-xl"
                          >
                            <Shield className="w-3.5 h-3.5 mr-1" />
                            Cambiar Rol
                          </Button>

                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => openStatusModal(user)}
                            disabled={isSelf}
                            title={isSelf ? 'No puedes suspender tu propia cuenta' : ''}
                            className={`text-xs rounded-xl ${
                              user.is_active
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {user.is_active ? (
                              <>
                                <Lock className="w-3.5 h-3.5 mr-1" />
                                Suspender
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 mr-1" />
                                Activar
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-card-secondary">
          <div>
            Mostrando <span className="font-semibold text-foreground">{users.length}</span> de{' '}
            <span className="font-semibold text-foreground">{total}</span> perfiles registrados
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              disabled={page <= 1 || isLoading}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              className="bg-surface-raised/50 hover:bg-surface-raised text-foreground disabled:opacity-30 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>

            <span className="px-3 py-1 bg-surface-input rounded-lg border border-border-subtle font-semibold text-foreground">
              {page} / {totalPages}
            </span>

            <Button
              size="sm"
              variant="flat"
              disabled={page >= totalPages || isLoading}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="bg-surface-raised/50 hover:bg-surface-raised text-foreground disabled:opacity-30 rounded-xl"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Role Change Modal */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-border-subtle rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-kyo-lightPurple/20 border border-kyo-lightPurple/30 flex items-center justify-center text-kyo-lightPurple">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Modificar Rol de Usuario</h3>
                  <p className="text-xs text-on-surface-card-secondary">Actualiza los permisos de acceso y moderación</p>
                </div>
              </div>
              <button
                onClick={closeRoleModal}
                className="text-on-surface-card-secondary hover:text-foreground p-1 rounded-lg hover:bg-surface-raised/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Summary */}
            <div className="p-3.5 rounded-2xl bg-surface-input border border-border-subtle space-y-1">
              <div className="text-xs text-on-surface-card-secondary uppercase font-semibold tracking-wider">Usuario Seleccionado</div>
              <div className="text-sm font-bold text-foreground">{selectedUserForRole.full_name || 'Sin nombre'}</div>
              <div className="text-xs text-kyo-lightPurple font-mono">{selectedUserForRole.email || selectedUserForRole.id}</div>
              <div className="text-xs text-on-surface-card-secondary pt-1">
                Rol actual: <span className="font-semibold text-foreground capitalize">{selectedUserForRole.role}</span>
              </div>
            </div>

            {/* Self-Demotion Warning Alert */}
            {selectedUserForRole.id === currentUserId && selectedNewRole === 'user' && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-bold">Advertencia crítica de seguridad:</span> Estás a punto de revocar tus propios privilegios de administrador. Si confirmas este cambio, perderás inmediatamente el acceso al panel `/admin`.
                </div>
              </div>
            )}

            {/* Role Options */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-on-surface-card-secondary uppercase tracking-wider block">
                Selecciona el Nuevo Rol
              </label>

              {/* User Option */}
              <label
                onClick={() => setSelectedNewRole('user')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedNewRole === 'user'
                    ? 'bg-blue-500/10 border-blue-500/50 text-foreground'
                    : 'bg-surface-input border-border-subtle text-on-surface-card-secondary hover:border-border-subtle'
                }`}
              >
                <input
                  type="radio"
                  name="roleChoice"
                  checked={selectedNewRole === 'user'}
                  onChange={() => setSelectedNewRole('user')}
                  className="mt-1 text-kyo-lightPurple focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-sm text-foreground">Usuario Regular (user)</div>
                  <div className="text-xs text-on-surface-card-secondary">Acceso estándar a billetera, agenda, metas y simulador personal. Sin privilegios administrativos.</div>
                </div>
              </label>

              {/* Admin Option */}
              <label
                onClick={() => setSelectedNewRole('admin')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedNewRole === 'admin'
                    ? 'bg-kyo-lightPurple/15 border-kyo-lightPurple/50 text-foreground'
                    : 'bg-surface-input border-border-subtle text-on-surface-card-secondary hover:border-border-subtle'
                }`}
              >
                <input
                  type="radio"
                  name="roleChoice"
                  checked={selectedNewRole === 'admin'}
                  onChange={() => setSelectedNewRole('admin')}
                  className="mt-1 text-kyo-lightPurple focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-sm text-kyo-lightPurple">Administrador (admin)</div>
                  <div className="text-xs text-on-surface-card-secondary">Acceso completo a la consola `/admin`: métricas, moderación de perfiles, aprobación de lista de espera y catálogo de bancos.</div>
                </div>
              </label>

              {/* Superadmin Option */}
              <label
                onClick={() => setSelectedNewRole('superadmin')}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedNewRole === 'superadmin'
                    ? 'bg-purple-900/30 border-purple-500/50 text-foreground'
                    : 'bg-surface-input border-border-subtle text-on-surface-card-secondary hover:border-border-subtle'
                }`}
              >
                <input
                  type="radio"
                  name="roleChoice"
                  checked={selectedNewRole === 'superadmin'}
                  onChange={() => setSelectedNewRole('superadmin')}
                  className="mt-1 text-purple-400 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-sm text-purple-300 flex items-center gap-1.5">
                    <span>Superadministrador (superadmin)</span>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  </div>
                  <div className="text-xs text-on-surface-card-secondary">Control total de la infraestructura, asignación de administradores y políticas de seguridad avanzadas.</div>
                </div>
              </label>
            </div>

            {/* Error or Success feedback */}
            {roleModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {roleModalError}
              </div>
            )}
            {roleModalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {roleModalSuccess}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button
                variant="flat"
                onPress={closeRoleModal}
                disabled={updateRoleMutation.isPending}
                className="bg-surface-raised/50 hover:bg-surface-raised text-on-surface-card-body rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                onPress={handleConfirmRoleChange}
                disabled={!roleEditingAllowed || updateRoleMutation.isPending || selectedNewRole === selectedUserForRole.role}
                className="bg-brand-primary hover:bg-[#5b21b6] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#6d28d9]/30"
              >
                {updateRoleMutation.isPending ? 'Guardando...' : 'Confirmar Cambio de Rol'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Account Status Confirmation Modal */}
      {selectedUserForStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-border-subtle rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                selectedUserForStatus.is_active
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {selectedUserForStatus.is_active ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {selectedUserForStatus.is_active ? 'Suspender Cuenta' : 'Reactivar Cuenta'}
                </h3>
                <p className="text-xs text-on-surface-card-secondary">
                  {selectedUserForStatus.email || selectedUserForStatus.full_name || selectedUserForStatus.id}
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-card-body leading-relaxed">
              {selectedUserForStatus.is_active
                ? '¿Estás seguro de que deseas suspender el acceso de este usuario? Su sesión se invalidará y no podrá operar en la plataforma hasta ser reactivado.'
                : '¿Estás seguro de que deseas reactivar esta cuenta? El usuario volverá a tener acceso normal a sus cuentas y finanzas.'}
            </p>

            {statusModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {statusModalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Button
                variant="flat"
                size="sm"
                onPress={closeStatusModal}
                disabled={toggleStatusMutation.isPending}
                className="bg-surface-raised/50 hover:bg-surface-raised text-on-surface-card-body rounded-xl text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onPress={handleConfirmStatusToggle}
                disabled={toggleStatusMutation.isPending}
                className={`text-xs font-bold rounded-xl shadow-lg ${
                  selectedUserForStatus.is_active
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                }`}
              >
                {toggleStatusMutation.isPending
                  ? 'Procesando...'
                  : selectedUserForStatus.is_active
                  ? 'Confirmar Suspensión'
                  : 'Confirmar Reactivación'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminUsersTab;
