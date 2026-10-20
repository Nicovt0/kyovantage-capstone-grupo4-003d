import { PageHeader } from "@/shared/ui/PageHeader";
import { Button } from "@heroui/react";
import { User as UserIcon, Mail, Key, CalendarDays, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  getAccountUser,
  updatePassword,
  updateProfileName,
  type AccountUser,
} from '@/features/settings/api/userRepository';
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

export default function AccountSettingsPage() {
  const { runMutation } = usePrivateMutation([['admin']]);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [name, setName] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const accountUser = await getAccountUser();
      if (!accountUser) return;
      setUser(accountUser);
      setName(accountUser.name);
    };

    fetchUser();
  }, []);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await runMutation(() => updateProfileName(trimmedName));
      setUser((current) => current ? { ...current, name: trimmedName } : current);
      setMessage('Perfil actualizado correctamente.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmPassword || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await runMutation(() => updatePassword(password));
      setPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setMessage('Contraseña actualizada correctamente.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div className="p-10 text-center text-[#5a5a72]">Cargando perfil...</div>;

  const formattedDate = new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(user.created_at));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">
      <PageHeader title="Perfil de Usuario" showBack />

      <div className="flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6d28d9] to-[#9353d3] text-white flex items-center justify-center text-4xl font-black shadow-lg">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
          <div className="flex items-center justify-center gap-1 text-[#17c964] mt-1">
            <ShieldCheck size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">Cuenta Verificada</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="profile-name" className="text-[12px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider ml-1">Nombre visible o apodo</label>
          <div className="flex items-center gap-3 bg-default-50 dark:bg-surface-card p-3.5 rounded-2xl border border-transparent focus-within:border-[#6d28d9] transition-all">
            <UserIcon size={20} className="text-[#6d28d9]" />
            <input id="profile-name" type="text" value={name} onChange={(event) => setName(event.target.value)} className="bg-transparent border-none outline-none w-full font-bold text-foreground" required />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-bold text-[#5a5a72] dark:text-[#a0a0b0] uppercase tracking-wider ml-1">Correo Electrónico</label>
          <div className="flex items-center gap-3 bg-default-50 dark:bg-surface-card p-3.5 rounded-2xl border border-transparent">
            <Mail size={20} className="text-[#5a5a72]" />
            <input type="email" value={user.email} readOnly className="bg-transparent border-none outline-none w-full font-bold text-foreground opacity-70 cursor-not-allowed" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between bg-default-50 dark:bg-surface-card p-3.5 rounded-2xl border border-transparent">
            <div className="flex items-center gap-3">
              <Key size={20} className="text-[#f5a524]" />
              <span className="font-bold text-foreground tracking-[0.3em]">••••••••</span>
            </div>
            <Button type="button" size="sm" variant="ghost" onPress={() => setShowPasswordForm((visible) => !visible)} className="font-bold bg-default-200 dark:bg-surface-raised text-foreground">
              {showPasswordForm ? 'Cancelar' : 'Cambiar'}
            </Button>
          </div>

          {showPasswordForm && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#6d28d9]/30 p-4">
              <input type="password" minLength={8} placeholder="Nueva contraseña" value={password} onChange={(event) => setPassword(event.target.value)} className="bg-default-50 dark:bg-surface-card rounded-xl p-3 outline-none" />
              <input type="password" minLength={8} placeholder="Confirmar contraseña" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="bg-default-50 dark:bg-surface-card rounded-xl p-3 outline-none" />
              <Button type="button" onPress={() => void handleChangePassword({ preventDefault: () => undefined } as FormEvent)} isDisabled={saving || password.length < 8 || password !== confirmPassword} className="bg-brand-primary text-white font-bold">
                {saving ? 'Guardando...' : 'Actualizar contraseña'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 bg-default-50 dark:bg-surface-card p-3.5 rounded-2xl border border-transparent opacity-80">
          <CalendarDays size={20} className="text-[#006FEE]" />
          <span className="font-bold text-foreground">Miembro desde {formattedDate}</span>
        </div>

        {(message || error) && <p className={error ? 'text-danger text-sm' : 'text-success text-sm'}>{error || message}</p>}

        <div className="flex justify-end mt-2">
          <Button type="submit" isDisabled={saving || !name.trim()} className="bg-brand-primary text-white font-bold h-12 px-8 rounded-xl shadow-md">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
