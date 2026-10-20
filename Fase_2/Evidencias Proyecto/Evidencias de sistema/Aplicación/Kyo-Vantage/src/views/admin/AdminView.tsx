import AdminScreen from '@/features/admin/screens/AdminScreen';

export function AdminView() {
  return <AdminScreen />;
}

export { AdminMetricsDashboard } from '@/features/admin/components/AdminMetricsDashboard';
export { AdminUsersTab } from '@/features/admin/components/AdminUsersTab';
export { default as AdminBanksAndTemplatesTab } from '@/features/admin/components/AdminBanksAndTemplatesTab';
export default AdminView;
