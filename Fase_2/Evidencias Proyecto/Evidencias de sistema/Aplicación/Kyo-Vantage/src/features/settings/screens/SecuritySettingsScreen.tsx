import { PageHeader } from "@/shared/ui/PageHeader";
import { Fingerprint, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEFAULT_SECURITY_SETTINGS,
  getSecuritySettings,
  updateSecuritySettings,
  type SecuritySettings,
} from '@/features/settings/api/userRepository';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

export default function SecuritySettingsPage() {
  const { runMutation } = usePrivateMutation();
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setSettings(await getSecuritySettings());
    };
    void loadSettings();
  }, []);

  const toggleSetting = async (key: keyof SecuritySettings) => {
    if (saving) return;
    const nextSettings = { ...settings, [key]: !settings[key] };
    setSettings(nextSettings);
    setSaving(true);
    setMessage(null);

    try {
      await runMutation(() => updateSecuritySettings(nextSettings));
      setMessage('Preferencia guardada.');
    } catch (error) {
      setSettings(settings);
      const detail = error instanceof Error ? error.message : 'error desconocido';
      setMessage(`No se pudo guardar: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">
      <PageHeader title="Seguridad y Privacidad" showBack />

      <div className="flex flex-col gap-6">
        <div className="bg-gradient-to-br from-[#6d28d9] to-[#9353d3] rounded-3xl p-6 text-white shadow-lg shadow-[#6d28d9]/20 relative overflow-hidden flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2"><Lock size={32} /></div>
          <h2 className="text-xl font-bold">Tu bóveda financiera</h2>
          <p className="text-white/80 text-sm max-w-[280px]">Habilita capas adicionales de seguridad para que nadie más pueda ver tus números.</p>
        </div>

        <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-2 shadow-sm flex flex-col">
          <button type="button" className="flex items-center justify-between p-4 cursor-pointer hover:bg-default-50 dark:hover:bg-surface-card rounded-2xl transition-colors text-left" onClick={() => void toggleSetting('usePin')}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${settings.usePin ? 'bg-[#006FEE]/10 text-[#006FEE]' : 'bg-default-100 dark:bg-surface-raised text-[#5a5a72]'}`}><Lock size={20} /></div>
              <div className="flex flex-col"><span className="font-bold text-[15px] text-foreground">Bloqueo por PIN</span><span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Solicitar PIN de 4 dígitos al abrir</span></div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${settings.usePin ? 'bg-[#006FEE]' : 'bg-default-200 dark:bg-surface-raised'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${settings.usePin ? 'translate-x-6' : ''}`} /></div>
          </button>

          <div className="h-[1px] bg-default-100 dark:bg-default-100/5 ml-20" />

          <button type="button" className="flex items-center justify-between p-4 cursor-pointer hover:bg-default-50 dark:hover:bg-surface-card rounded-2xl transition-colors text-left" onClick={() => void toggleSetting('useBiometrics')}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${settings.useBiometrics ? 'bg-[#17c964]/10 text-[#17c964]' : 'bg-default-100 dark:bg-surface-raised text-[#5a5a72]'}`}><Fingerprint size={20} /></div>
              <div className="flex flex-col"><span className="font-bold text-[15px] text-foreground">Acceso Biométrico</span><span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Huella dactilar o Face ID</span></div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center ${settings.useBiometrics ? 'bg-[#17c964]' : 'bg-default-200 dark:bg-surface-raised'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${settings.useBiometrics ? 'translate-x-6' : ''}`} /></div>
          </button>
        </div>

        {message && <p className="text-sm text-foreground">{message}</p>}
      </div>
    </div>
  );
}
