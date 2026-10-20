import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('SP2-09: Database Indexes & Query Performance Optimization', () => {
  describe('Objective 1: Database High-Performance Migration & Indexes', () => {
    const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
    const migrationFile = path.join(migrationsDir, '20261007000000_perf_indexes_recurring_accounts.sql');

    test('Migration file exists in supabase/migrations/', () => {
      assert.ok(fs.existsSync(migrationFile), 'Migration file must exist in supabase/migrations/');
    });

    test('Migration defines composite indexes on recurring_templates for frequent queries', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      // (user_id, status)
      assert.match(
        sql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.recurring_templates\s*\(\s*user_id\s*,\s*status\s*\)/i,
        'Must define composite index on recurring_templates(user_id, status)'
      );

      // (user_id, payment_day)
      assert.match(
        sql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.recurring_templates\s*\(\s*user_id\s*,\s*payment_day\s*\)/i,
        'Must define composite index on recurring_templates(user_id, payment_day)'
      );
    });

    test('Migration defines foreign key indexes on recurring_templates for joins', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      // account_id FK index
      assert.match(
        sql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.recurring_templates\s*\(\s*account_id\s*\)/i,
        'Must define index on recurring_templates(account_id)'
      );

      // credit_card_id FK index
      assert.match(
        sql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.recurring_templates\s*\(\s*credit_card_id\s*\)/i,
        'Must define index on recurring_templates(credit_card_id)'
      );
    });

    test('Migration defines index on accounts for active user queries', () => {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      // ensures accounts.is_active column exists
      assert.match(
        sql,
        /ALTER\s+TABLE\s+public\.accounts\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+is_active\s+boolean/i,
        'Must ensure is_active column exists on accounts'
      );

      // (user_id, is_active)
      assert.match(
        sql,
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.accounts\s*\(\s*user_id\s*,\s*is_active\s*\)/i,
        'Must define composite index on accounts(user_id, is_active)'
      );
    });
  });

  describe('Objective 2: TanStack Query v5 Cache Configuration & Prefetching', () => {
    test('queryClient configures consistent 5m staleTime and 30m gcTime', () => {
      const queryClientPath = path.join(rootDir, 'src', 'lib', 'queryClient.ts');
      const content = fs.readFileSync(queryClientPath, 'utf8');

      assert.match(content, /staleTime:\s*1000\s*\*\s*60\s*\*\s*5/, 'staleTime must be 5 minutes (300,000ms)');
      assert.match(content, /gcTime:\s*1000\s*\*\s*60\s*\*\s*30/, 'gcTime must be 30 minutes (1,800,000ms)');
    });

    test('prefetchRoutes.ts exports prefetchRoute and prefetchCriticalRoutes for key routes', async () => {
      const prefetchModulePath = path.join(rootDir, 'src', 'lib', 'prefetchRoutes.ts');
      assert.ok(fs.existsSync(prefetchModulePath), 'prefetchRoutes.ts must exist');

      const content = fs.readFileSync(prefetchModulePath, 'utf8');
      assert.match(content, /export\s+async\s+function\s+prefetchRoute/, 'Must export prefetchRoute');
      assert.match(content, /export\s+async\s+function\s+prefetchCriticalRoutes/, 'Must export prefetchCriticalRoutes');

      // Handles /agenda, /wallet and /dashboard
      assert.ok(content.includes("route.startsWith('/agenda')"), 'Must prefetch /agenda');
      assert.ok(content.includes("route.startsWith('/wallet')"), 'Must prefetch /wallet');
      assert.ok(content.includes("route.startsWith('/dashboard')"), 'Must prefetch /dashboard');
    });

    test('SideNav and BottomNav wire prefetchRoute on hover and touch', () => {
      const sideNavPath = path.join(rootDir, 'src', 'features', 'app-shell', 'components', 'layout', 'SideNav', 'index.tsx');
      const bottomNavPath = path.join(rootDir, 'src', 'features', 'app-shell', 'components', 'layout', 'BottomNav', 'index.tsx');

      const sideNavContent = fs.readFileSync(sideNavPath, 'utf8');
      const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');

      assert.ok(sideNavContent.includes('prefetchRoute(queryClient, item.href'), 'SideNav must trigger prefetchRoute on hover/focus');
      assert.ok(bottomNavContent.includes('prefetchRoute(queryClient, item.href'), 'BottomNav must trigger prefetchRoute on touch/hover');
    });

    test('AppShell triggers idle prefetch of critical routes', () => {
      const appShellPath = path.join(rootDir, 'src', 'features', 'app-shell', 'components', 'AppShell.tsx');
      const content = fs.readFileSync(appShellPath, 'utf8');

      assert.ok(content.includes('prefetchCriticalRoutes'), 'AppShell must invoke prefetchCriticalRoutes');
    });

    test('Mutations selectively invalidate only affected queries without blanket wipes', () => {
      const modalPath = path.join(rootDir, 'src', 'views', 'wallet', 'components', 'AddInstrumentModal.tsx');
      const modalContent = fs.readFileSync(modalPath, 'utf8');

      assert.ok(
        !modalContent.includes('await queryClient.invalidateQueries();'),
        'AddInstrumentModal must NOT perform blanket cache invalidations'
      );
      assert.ok(
        modalContent.includes('queryKeys.wallet.accounts()'),
        'AddInstrumentModal must target accounts query'
      );

      const agendaEventsPath = path.join(rootDir, 'src', 'features', 'agenda', 'hooks', 'useAgendaEvents.ts');
      const agendaContent = fs.readFileSync(agendaEventsPath, 'utf8');

      assert.ok(
        agendaContent.includes('queryKeys.agenda.all'),
        'useAgendaEvents mutations must invalidate queryKeys.agenda.all'
      );
    });
  });

  describe('Objective 3: Re-render Audit & Data Selector Stability', () => {
    test('useAvailableLiquidity implements stable memoization and refetch handler', () => {
      const liquidityPath = path.join(rootDir, 'src', 'features', 'dashboard', 'hooks', 'useAvailableLiquidity.ts');
      const content = fs.readFileSync(liquidityPath, 'utf8');

      assert.ok(content.includes('useCallback'), 'refetch must be wrapped in useCallback');
      assert.ok(content.includes('refTime'), 'referenceDate must be evaluated with timestamp stability');
      assert.match(
        content,
        /return\s+useMemo\(\s*\(\)\s*=>\s*\(\{/i,
        'useAvailableLiquidity return object must be wrapped in useMemo'
      );
    });

    test('useAccounts supports generic selectors and provides selectActiveAccounts', () => {
      const useAccountsPath = path.join(rootDir, 'src', 'features', 'wallet', 'hooks', 'useAccounts.ts');
      const content = fs.readFileSync(useAccountsPath, 'utf8');

      assert.ok(content.includes('select?: (data: Account[]) => TData'), 'useAccounts must support select option');
      assert.ok(content.includes('selectActiveAccounts'), 'Must export selectActiveAccounts selector');
      assert.ok(content.includes('selectAccountsTotalBalance'), 'Must export selectAccountsTotalBalance selector');
    });

    test('selectActiveAccounts accurately filters unarchived and active accounts', async () => {
      const { selectActiveAccounts, selectAccountsTotalBalance } = await import(
        '../src/features/wallet/selectors/accountSelectors.ts'
      );

      const sampleAccounts = [
        { id: '1', name: 'Cuenta 1', balance: 1000, is_archived: false, is_active: true, include_in_total: true },
        { id: '2', name: 'Cuenta 2', balance: 500, is_archived: true, is_active: false, include_in_total: true },
        { id: '3', name: 'Cuenta 3', balance: 200, is_archived: false, is_active: false, include_in_total: true },
        { id: '4', name: 'Cuenta 4', balance: 300, is_archived: false, is_active: true, include_in_total: false },
      ];

      const active = selectActiveAccounts(sampleAccounts);
      assert.equal(active.length, 2);
      assert.deepEqual(active.map(a => a.id), ['1', '4']);

      const totalBalance = selectAccountsTotalBalance(sampleAccounts);
      assert.equal(totalBalance, 1000); // only account 1 counts: active & include_in_total
    });
  });
});
