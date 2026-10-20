import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Isolated demo fixtures: real-data/error behavior is covered in adminOverview.test.mjs.
process.env.VITE_USE_MOCKS = 'true';
const { getPlatformStats, getRecentActivityLogs } = await import('../src/features/admin/api/adminMetricsRepository.ts');

describe('Admin Metrics & Platform Health [SP2-13]', () => {
  const rootDir = process.cwd();

  describe('adminMetricsRepository.ts - Data Access & Aggregation', () => {
    it('getPlatformStats returns comprehensive stats object with systemHealth', async () => {
      const stats = await getPlatformStats();

      assert.ok(stats, 'Stats must be defined');
      assert.equal(typeof stats.totalUsers, 'number');
      assert.equal(typeof stats.activeUsers, 'number');
      assert.equal(typeof stats.totalCommitments, 'number');
      assert.equal(typeof stats.projectedMonthlyCommitments, 'number');
      assert.equal(typeof stats.totalAccounts, 'number');
      assert.equal(typeof stats.totalManagedBalance, 'number');

      // Validate systemHealth object
      assert.ok(stats.systemHealth, 'systemHealth must be defined');
      assert.ok(['healthy', 'degraded', 'offline'].includes(stats.systemHealth.status));
      assert.equal(typeof stats.systemHealth.latencyMs, 'number');
      assert.ok(['connected', 'disconnected'].includes(stats.systemHealth.database));
      assert.ok(['operational', 'degraded'].includes(stats.systemHealth.authService));
      assert.ok(stats.systemHealth.checkedAt, 'checkedAt timestamp must be present');
    });

    it('getRecentActivityLogs returns sorted logs with required audit fields', async () => {
      const logs = await getRecentActivityLogs();

      assert.ok(Array.isArray(logs), 'Logs must be an array');
      assert.ok(logs.length > 0, 'Should have at least one activity log entry');

      const first = logs[0];
      assert.ok(first.id, 'Log must have an id');
      assert.ok(first.timestamp, 'Log must have a timestamp');
      assert.ok(first.user, 'Log must have a user identifier');
      assert.ok(first.action, 'Log must have an action');
      assert.ok(first.entity, 'Log must have an entity');
      assert.ok(['success', 'pending', 'warning', 'error'].includes(first.status));
    });
  });

  describe('useAdminMetrics.ts - TanStack Query Configuration', () => {
    const hookPath = resolve(rootDir, 'src/features/admin/hooks/useAdminMetrics.ts');

    it('hook file exists and exports query keys and hooks', () => {
      assert.ok(existsSync(hookPath), 'src/features/admin/hooks/useAdminMetrics.ts must exist');
      const content = readFileSync(hookPath, 'utf-8');

      assert.match(content, /export const ADMIN_METRICS_QUERY_KEYS/, 'Must export ADMIN_METRICS_QUERY_KEYS');
      assert.match(content, /export function usePlatformStats/, 'Must export usePlatformStats');
      assert.match(content, /export function useRecentActivityLogs/, 'Must export useRecentActivityLogs');
      assert.match(content, /export function useAdminMetricsDashboard/, 'Must export useAdminMetricsDashboard');
    });

    it('enforces controlled staleTime (60s) to avoid aggressive database polling', () => {
      const content = readFileSync(hookPath, 'utf-8');

      // Stale time must be 60 seconds (1000 * 60)
      assert.match(content, /staleTime:\s*(1000\s*\*\s*60|60000)/, 'staleTime must be 60 seconds (60,000ms)');
      assert.match(content, /refetchOnWindowFocus:\s*false/, 'refetchOnWindowFocus must be false to avoid query spam');
    });
  });

  describe('AdminMetricsDashboard.tsx - UI & Responsive Monitoring Widgets', () => {
    const dashboardPath = resolve(rootDir, 'src/features/admin/components/AdminMetricsDashboard.tsx');

    it('dashboard component exists and renders 4 statistical cards', () => {
      assert.ok(existsSync(dashboardPath), 'AdminMetricsDashboard.tsx must exist');
      const content = readFileSync(dashboardPath, 'utf-8');

      assert.match(content, /Usuarios Registrados/, 'Card for registered users must exist');
      assert.match(content, /Compromisos del Mes/, 'Card for monthly commitments must exist');
      assert.match(content, /Volumen Gestionado/, 'Card for managed balance volume must exist');
      assert.match(content, /Salud Supabase/, 'Card for Supabase service health must exist');
    });

    it('implements loading skeletons and responsive error state', () => {
      const content = readFileSync(dashboardPath, 'utf-8');

      assert.match(content, /animate-pulse/, 'Loading skeletons must use animate-pulse');
      assert.match(content, /role="alert"/, 'Error alert banner must use role="alert"');
      assert.match(content, /Reintentar/, 'Must offer retry action on error');
    });

    it('renders compact audit table with date, user, action, entity and status', () => {
      const content = readFileSync(dashboardPath, 'utf-8');

      assert.match(content, /<table/i, 'Audit log table must be present');
      assert.match(content, /Fecha y Hora/, 'Audit table must have date header');
      assert.match(content, /Usuario \/ Identificador/, 'Audit table must have user header');
      assert.match(content, /Acción/, 'Audit table must have action header');
      assert.match(content, /Entidad/, 'Audit table must have entity header');
      assert.match(content, /Estado/, 'Audit table must have status header');
      assert.match(content, /Detalles/, 'Audit table must have details header');
    });
  });

  describe('AdminScreen.tsx & AdminView.tsx - Tab Integration', () => {
    const screenPath = resolve(rootDir, 'src/features/admin/screens/AdminScreen.tsx');
    const viewPath = resolve(rootDir, 'src/views/admin/AdminView.tsx');

    it('AdminScreen integrates tab navigation for Métricas y Plataforma', () => {
      assert.ok(existsSync(screenPath), 'AdminScreen.tsx must exist');
      const content = readFileSync(screenPath, 'utf-8');

      assert.match(content, /Métricas y Plataforma/, 'AdminScreen must have Métricas y Plataforma tab');
      assert.match(content, /Lista de Espera/, 'AdminScreen must preserve Lista de Espera tab');
      assert.match(content, /<AdminMetricsDashboard\s*\/>/, 'AdminScreen must render AdminMetricsDashboard');
      assert.match(content, /<AdminWaitlistTab\s*\/>/, 'AdminScreen must preserve waitlist functionality');
    });

    it('AdminView renders AdminScreen cleanly', () => {
      assert.ok(existsSync(viewPath), 'AdminView.tsx must exist');
      const content = readFileSync(viewPath, 'utf-8');

      assert.match(content, /<AdminScreen\s*\/>/, 'AdminView must render AdminScreen');
    });
  });
});
