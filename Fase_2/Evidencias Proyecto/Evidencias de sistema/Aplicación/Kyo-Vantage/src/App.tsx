import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProviders } from '@/features/app-shell/providers/AppProviders';
import { AppShell } from '@/features/app-shell/components/AppShell';
import { RootGuard } from '@/routes/RootGuard';
import { AdminGuard } from '@/features/admin/components/AdminGuard';
import { OfflineNotice } from '@/components/common/OfflineNotice';

const TermsPage = lazy(() => import('@/views/legal/TermsPage'));
const PrivacyPage = lazy(() => import('@/views/legal/PrivacyPage'));
const LandingPage = lazy(() => import('@/components/home/LandingPage').then(module => ({ default: module.LandingPage })));
const LoginScreen = lazy(() => import('@/features/auth/components/LoginScreen').then(module => ({ default: module.LoginScreen })));
const RegisterScreen = lazy(() => import('@/features/auth/components/RegisterScreen').then(module => ({ default: module.RegisterScreen })));
const ActualizarPasswordPage = lazy(() => import('@/features/auth/components/ActualizarPasswordScreen'));
const AdminScreen = lazy(() => import('@/features/admin/screens/AdminScreen'));
const DashboardView = lazy(() => import('@/views/dashboard/DashboardView').then(module => ({ default: module.DashboardView })));
const WalletView = lazy(() => import('@/views/wallet/WalletView').then(module => ({ default: module.WalletView })));
const WalletDetailView = lazy(() => import('@/views/wallet/WalletDetailView').then(module => ({ default: module.WalletDetailView })));
const TransactionsView = lazy(() => import('@/features/wallet/screens/TransactionsScreen'));
const AddTransactionView = lazy(() => import('@/features/wallet/screens/AddTransactionScreen'));
const PlanningView = lazy(() => import('@/views/planning/PlanningView').then(module => ({ default: module.PlanningView })));
const AgendaView = lazy(() => import('@/views/agenda/AgendaView').then(module => ({ default: module.AgendaView })));
const SettingsView = lazy(() => import('@/views/settings/SettingsView').then(module => ({ default: module.SettingsView })));

const CustomCategoriesPage = lazy(() => import('@/features/settings/screens/CustomCategoriesScreen'));
const CustomCategoryFormPage = lazy(() => import('@/features/settings/screens/CustomCategoryFormScreen'));
const AccountSettingsPage = lazy(() => import('@/features/settings/screens/AccountSettingsScreen'));
const SecuritySettingsPage = lazy(() => import('@/features/settings/screens/SecuritySettingsScreen'));
const SupportPage = lazy(() => import('@/features/settings/screens/SupportScreen'));

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <OfflineNotice />
        <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-[#06020d] text-white">Cargando…</div>}>
          <Routes>
            <Route path="/" element={<main className="dark bg-[#06020d] text-white min-h-screen w-full overflow-x-hidden"><LandingPage /></main>} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route path="/actualizar-password" element={<ActualizarPasswordPage />} />
            <Route path="/admin" element={<AdminGuard><AdminScreen /></AdminGuard>} />
            <Route element={<RootGuard />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardView />} />
                <Route path="/wallet" element={<WalletView />} />
                <Route path="/wallet/transactions" element={<TransactionsView />} />
                <Route path="/wallet/transaction/add" element={<AddTransactionView />} />
                <Route path="/wallet/detail" element={<WalletDetailView />} />
                <Route path="/wallet/account/detail" element={<WalletDetailView />} />
                <Route path="/credit-cards/detail" element={<WalletDetailView />} />
                <Route path="/planning" element={<PlanningView />} />
                <Route path="/agenda" element={<AgendaView />} />
                <Route path="/planning/categories" element={<Navigate to="/settings/custom-categories" replace />} />
                <Route path="/planning/categories/form" element={<LegacyCategoryFormRedirect />} />
                <Route path="/settings/custom-categories" element={<CustomCategoriesPage />} />
                <Route path="/settings/custom-categories/form" element={<CustomCategoryFormPage />} />
                <Route path="/settings/fixed-incomes/*" element={<Navigate to="/agenda" replace />} />
                <Route path="/settings/fixed-expenses/*" element={<Navigate to="/agenda" replace />} />
                <Route path="/settings/recurring-items/*" element={<Navigate to="/agenda" replace />} />
                <Route path="/settings/custom-banks" element={<Navigate to="/settings" replace />} />
                <Route path="/settings/custom-banks/form" element={<Navigate to="/settings" replace />} />
                <Route path="/settings/account" element={<AccountSettingsPage />} />
                <Route path="/settings/financial" element={<Navigate to="/settings" replace />} />
                <Route path="/settings/security" element={<SecuritySettingsPage />} />
                <Route path="/settings/support" element={<SupportPage />} />
                <Route path="/settings" element={<SettingsView />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppProviders>
    </BrowserRouter>
  );
}

function LegacyCategoryFormRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/settings/custom-categories/form${search}`} replace />;
}
