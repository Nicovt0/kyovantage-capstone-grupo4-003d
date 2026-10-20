import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('SP2-11: Admin Console - User & Profile Moderation', () => {
  describe('Objective 1: Database Migration & RLS Security Policies', () => {
    const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
    const migrationFile = path.join(migrationsDir, '20261007010000_admin_profiles_management_rls.sql');

    test('Migration file exists in supabase/migrations/', () => {
      assert.ok(fs.existsSync(migrationFile), 'Migration file must exist');
    });

    test('Migration ensures email, is_active, role, and is_admin columns on profiles', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      assert.match(
        sql,
        /ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+email\s+text/i,
        'Must ensure email column on profiles'
      );
      assert.match(
        sql,
        /ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+is_active\s+boolean/i,
        'Must ensure is_active column on profiles'
      );
      assert.match(
        sql,
        /ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+role\s+text/i,
        'Must ensure role column on profiles'
      );
      assert.match(
        sql,
        /ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+is_admin\s+boolean/i,
        'Must ensure is_admin column on profiles'
      );
    });

    test('Migration defines security trigger preventing non-admins from changing roles and sole admin self-demotion', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      assert.match(
        sql,
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.validate_profile_role_update/i,
        'Must create validate_profile_role_update trigger function'
      );
      assert.ok(
        sql.includes('public.is_admin_or_superadmin()'),
        'Trigger function must check public.is_admin_or_superadmin()'
      );
      assert.ok(
        sql.includes('trg_validate_profile_role_update'),
        'Must attach trigger trg_validate_profile_role_update'
      );
    });

    test('Migration configures strict RLS policies on profiles', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      assert.match(
        sql,
        /CREATE\s+POLICY\s+"profiles_select_policy"\s+ON\s+public\.profiles/i,
        'Must define profiles_select_policy'
      );
      assert.match(
        sql,
        /CREATE\s+POLICY\s+"profiles_update_policy"\s+ON\s+public\.profiles/i,
        'Must define profiles_update_policy'
      );
    });
  });

  describe('Objective 2: Admin Users Repository Layer', () => {
    const repoPath = path.join(rootDir, 'src', 'features', 'admin', 'api', 'adminUsersRepository.ts');

    test('adminUsersRepository.ts exists and exports required methods', () => {
      assert.ok(fs.existsSync(repoPath), 'adminUsersRepository.ts must exist');

      const content = fs.readFileSync(repoPath, 'utf8');
      assert.match(content, /export\s+async\s+function\s+getAllUsersAdmin/, 'Must export getAllUsersAdmin');
      assert.match(content, /export\s+async\s+function\s+updateUserRoleAdmin/, 'Must export updateUserRoleAdmin');
      assert.match(content, /export\s+async\s+function\s+toggleUserActiveStatusAdmin/, 'Must export toggleUserActiveStatusAdmin');
    });

    test('getAllUsersAdmin paginates and filters by role correctly', async () => {
      // Mock environment check
      process.env.VITE_USE_MOCKS = 'true';
      const { getAllUsersAdmin } = await import('../src/features/admin/api/adminUsersRepository.ts');

      const resAll = await getAllUsersAdmin({ limit: 2, page: 1 });
      assert.ok(Array.isArray(resAll.users), 'users must be an array');
      assert.equal(resAll.users.length, 2, 'Should paginate to limit 2');
      assert.equal(resAll.page, 1);
      assert.ok(resAll.total >= 2);

      const resAdmins = await getAllUsersAdmin({ roleFilter: 'admin' });
      assert.ok(resAdmins.users.every((u) => u.role === 'admin'));

      const resSearch = await getAllUsersAdmin({ search: 'nicolas' });
      assert.ok(resSearch.users.length > 0);
      assert.ok(resSearch.users.some((u) => u.email?.includes('nicolas') || u.full_name?.toLowerCase().includes('nicolas')));
    });

    test('updateUserRoleAdmin validates valid roles and rejects invalid roles', async () => {
      const { updateUserRoleAdmin } = await import('../src/features/admin/api/adminUsersRepository.ts');

      // Valid update
      const updated = await updateUserRoleAdmin('mock-user-1', 'admin', true);
      assert.equal(updated.role, 'admin');
      assert.equal(updated.is_admin, true);

      // Invalid role rejected
      await assert.rejects(
        () => updateUserRoleAdmin('mock-user-1', 'hacker', false),
        /Rol inválido/
      );
    });

    test('toggleUserActiveStatusAdmin updates active flag', async () => {
      const { toggleUserActiveStatusAdmin } = await import('../src/features/admin/api/adminUsersRepository.ts');

      const suspended = await toggleUserActiveStatusAdmin('mock-user-1', false);
      assert.equal(suspended.is_active, false);

      const reactivated = await toggleUserActiveStatusAdmin('mock-user-1', true);
      assert.equal(reactivated.is_active, true);
    });
  });

  describe('Objective 3: UI Integration in Admin Console', () => {
    test('AdminScreen.tsx integrates "Usuarios y Roles" tab', () => {
      const screenPath = path.join(rootDir, 'src', 'features', 'admin', 'screens', 'AdminScreen.tsx');
      const content = fs.readFileSync(screenPath, 'utf8');

      assert.ok(content.includes('Usuarios y Roles'), 'AdminScreen must have "Usuarios y Roles" tab title');
      assert.ok(content.includes("activeTab === 'users'"), 'AdminScreen must handle activeTab === "users"');
      assert.ok(content.includes('<AdminUsersTab />'), 'AdminScreen must render AdminUsersTab');
    });

    test('AdminUsersTab component exists with search, table, and modal confirmation', () => {
      const tabPath = path.join(rootDir, 'src', 'features', 'admin', 'components', 'AdminUsersTab.tsx');
      assert.ok(fs.existsSync(tabPath), 'AdminUsersTab.tsx must exist');

      const content = fs.readFileSync(tabPath, 'utf8');
      assert.ok(content.includes('useAdminUsers'), 'Must call useAdminUsers hook');
      assert.ok(content.includes('useUpdateUserRole'), 'Must call useUpdateUserRole hook');
      assert.ok(content.includes('useToggleUserActiveStatus'), 'Must call useToggleUserActiveStatus hook');
      assert.ok(content.includes('Confirmar Cambio de Rol'), 'Must render role confirmation action');
      assert.ok(content.includes('Advertencia crítica de seguridad'), 'Must render self-demotion warning check');
    });

    test('AdminView.tsx cleanly exports AdminUsersTab', () => {
      const viewPath = path.join(rootDir, 'src', 'views', 'admin', 'AdminView.tsx');
      const content = fs.readFileSync(viewPath, 'utf8');

      assert.ok(content.includes('export { AdminUsersTab }'), 'AdminView must export AdminUsersTab');
    });
  });
});
