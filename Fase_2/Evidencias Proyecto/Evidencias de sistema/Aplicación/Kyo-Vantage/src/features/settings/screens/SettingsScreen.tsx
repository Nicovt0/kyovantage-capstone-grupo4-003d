import { AppModal } from '@/shared/ui/AppModal';
import { FinancialSettingsPanel } from '../components/FinancialSettingsPanel';
import { Link } from 'react-router-dom';
import { ThemeSettingsRow } from "@/features/settings/components/ThemeSettingsRow";
import { PushNotificationSettingsRow } from "@/modules/notifications/components/PushNotificationSettingsRow";
import { PageHeader } from "@/shared/ui/PageHeader";
import { User, Fingerprint, CalendarDays, Tag, LifeBuoy, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { getLandingUrl } from '@/lib/siteUrls';
import { useAuth } from '@/features/auth/components/AuthProvider';

export default function V3Settings() {
  const { signOut } = useAuth();
  const [financialModalOpen, setFinancialModalOpen] = useState(false);
  const [backUrl, setBackUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setBackUrl(sessionStorage.getItem('lastMainRoute') || '/dashboard');
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20 w-full max-w-4xl mx-auto">
      <div className="flex flex-col w-full">
        <PageHeader
          title="Ajustes"
          description="Configura tu cuenta y preferencias del sistema"
          showBack
          backUrl={backUrl}
        />
      </div>

      {/* Cuenta */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] ml-2 mb-1">Cuenta y Seguridad</h2>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl overflow-hidden shadow-sm flex flex-col">

          <Link to="/settings/account" className="flex items-center gap-4 p-4 hover:bg-default-50 dark:hover:bg-surface-card transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-default-100 dark:bg-surface-raised text-foreground flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
              <User size={20} />
            </div>
            <div className="flex-1 flex flex-col">
              <span className="font-bold text-[15px] text-foreground">Perfil de Usuario</span>
              <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Datos personales y contraseña</span>
            </div>
            <ChevronRight size={20} className="text-default-300 dark:text-default-600" />
          </Link>

          <div className="h-[1px] bg-default-100 dark:bg-default-100/5 ml-16" />

          <Link to="/settings/security" className="flex items-center gap-4 p-4 hover:bg-default-50 dark:hover:bg-surface-card transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-default-100 dark:bg-surface-raised text-foreground flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
              <Fingerprint size={20} />
            </div>
            <div className="flex-1 flex flex-col">
              <span className="font-bold text-[15px] text-foreground">Seguridad y Privacidad</span>
              <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">PIN y huella dactilar</span>
            </div>
            <ChevronRight size={20} className="text-default-300 dark:text-default-600" />
          </Link>

        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] ml-2 mb-1">Preferencias financieras</h2>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <button type="button" onClick={() => setFinancialModalOpen(true)} className="w-full text-left flex items-center gap-4 p-4 hover:bg-default-50 dark:hover:bg-surface-card transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-default-100 dark:bg-surface-raised text-foreground flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
              <CalendarDays size={20} />
            </div>
            <div className="flex-1 flex flex-col">
              <span className="font-bold text-[15px] text-foreground">Mi mes financiero</span>
              <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Día de inicio e ingreso mensual estimado</span>
            </div>
            <ChevronRight size={20} className="text-default-300 dark:text-default-600" />
          </button>
          <div className="h-px bg-default-100 dark:bg-default-100/5 ml-16"/>
          <Link to="/settings/custom-categories" className="flex items-center gap-4 p-4 hover:bg-default-50 dark:hover:bg-surface-card transition-colors group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-default-100 dark:bg-surface-raised text-foreground group-hover:bg-brand-primary group-hover:text-white"><Tag size={20}/></div>
            <div className="flex flex-1 flex-col"><span className="text-[15px] font-bold text-foreground">Categorías personalizadas</span><span className="text-xs text-on-surface-card-secondary">Administra tus categorías de gastos e ingresos</span></div>
            <ChevronRight size={20} className="text-default-300 dark:text-default-600"/>
          </Link>
        </div>
      </section>

      {/* Personalización */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] ml-2 mb-1">Personalización</h2>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl overflow-hidden shadow-sm flex flex-col">

          <ThemeSettingsRow />

        </div>
      </div>

      {/* Notificaciones y Alertas */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] ml-2 mb-1">Notificaciones y Alertas</h2>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <PushNotificationSettingsRow />
        </div>
      </div>

      {/* Soporte */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] ml-2 mb-1">Ayuda</h2>
        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl overflow-hidden shadow-sm flex flex-col">

          <Link to="/settings/support" className="flex items-center gap-4 p-4 hover:bg-default-50 dark:hover:bg-surface-card transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-[#6d28d9] flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
              <LifeBuoy size={20} />
            </div>
            <div className="flex-1 flex flex-col">
              <span className="font-bold text-[15px] text-foreground">Soporte y Feedback</span>
              <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Sugerencias, errores o dudas</span>
            </div>
            <ChevronRight size={20} className="text-default-300 dark:text-default-600" />
          </Link>

        </div>
      </div>

      <AppModal
        isOpen={financialModalOpen}
        onClose={() => setFinancialModalOpen(false)}
        title="Mi mes financiero"
        description="Configura el inicio de tu período y tu ingreso mensual estimado"
        icon={<CalendarDays size={22} className="text-purple-400" />}
      >
        {financialModalOpen && <FinancialSettingsPanel />}
      </AppModal>

      {/* Cierre de sesión */}
      <div className="mt-4 flex justify-center w-full px-2">
        <div
          className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-surface-card border border-[#FCEBEB] dark:border-[#f31260]/30 rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all hover:bg-[#f31260]/10"
          onClick={async () => {
            await signOut(getLandingUrl());
          }}
        >
          <LogOut size={18} className="text-[#f31260]" />
          <span className="text-[13px] font-bold text-[#f31260]">Cerrar Sesión</span>
        </div>
      </div>

    </div>
  );
}
