import { Link, useNavigate } from 'react-router-dom';
import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, ArrowLeft, EyeOff, Check, Eye } from 'lucide-react';
import { AuthLogo } from '@/features/auth/components/AuthLogo';
import { createClient } from '@/utils/supabase/client';
import { ensureCashAccount } from '@/features/wallet/api/accountRepository';
import { getLandingUrl } from '@/lib/siteUrls';
import type { Session } from '@supabase/supabase-js';

export function LoginScreen() {
  const navigate = useNavigate();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let active = true;

    // La landing es pública. Si una sesión existente vuelve a este formulario,
    // conservamos la sesión y continuamos al dashboard sin pedir credenciales
    // ni provocar un cierre de sesión.
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (active && session) navigate('/dashboard', { replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate, supabase]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const isFormValid = useMemo(() => {
    return isEmailValid && password.length >= 6;
  }, [isEmailValid, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    await ensureCashAccount();

    navigate('/dashboard');

  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid || loading || cooldown > 0) return;

    setLoading(true);
    setError(null);
    setRecoveryMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setRecoveryMessage('Se ha enviado un enlace de recuperación a tu correo electrónico. Por favor, revísalo.');
    setCooldown(60);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-kyo-dark p-6 relative overflow-hidden">
      <a href={getLandingUrl()} className="absolute top-6 left-6 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-[13.5px] font-medium z-50">
        <ArrowLeft className="w-4 h-4" /> Volver
      </a>

      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-kyo-purple/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-kyo-lightPurple/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 mt-12">
          <AuthLogo />
        </div>

        <p className="text-gray-400 text-xs mt-2 text-center mb-10">
          {isRecovering ? (
            <>Ingresa tu correo electrónico y te enviaremos<br />un enlace para restablecer tu contraseña.</>
          ) : (
            <>Tu vida financiera con una perspectiva superior.</>
          )}
        </p>

        {isRecovering ? (
          <form onSubmit={handleRecoverPassword} className="w-full space-y-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Correo electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-kyo-lightPurple focus:bg-white/10 transition-all text-[15px] pr-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                {isEmailValid && <Check className="w-4 h-4 text-[#5DCAA5] absolute right-4 top-1/2 -translate-y-1/2" />}
              </div>
            </div>

            {error && <p className="text-[#E24B4A] text-sm text-center">{error}</p>}
            {recoveryMessage && <p className="text-[#5DCAA5] text-sm text-center font-medium">{recoveryMessage}</p>}
            {cooldown > 0 && <p className="text-xs text-gray-500 text-center">Puedes solicitar un nuevo correo en {cooldown}s...</p>}

            <button
              type="submit"
              className={`w-full bg-brand-primary text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(107,98,212,0.3)] transition-all mt-6 ${(!isEmailValid || loading || cooldown > 0) ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
              disabled={!isEmailValid || loading || cooldown > 0}
            >
              {loading ? 'Enviando...' : cooldown > 0 ? `Reintentar en ${cooldown}s` : 'Recuperar'} <ArrowRight size={18} />
            </button>

            <p className="text-gray-400 text-sm mt-8 text-center px-4">
              ¿Recordaste tu contraseña?{' '}
              <button
                type="button"
                onClick={() => { setIsRecovering(false); setError(null); setRecoveryMessage(null); }}
                className="text-kyo-lightPurple font-bold hover:underline"
              >
                Inicia sesión
              </button>
            </p>
          </form>
        ) : (
          <>
            <form onSubmit={handleLogin} className="w-full space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-kyo-lightPurple focus:bg-white/10 transition-all text-[15px]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-kyo-lightPurple focus:bg-white/10 transition-all text-[15px] pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-[#E24B4A] text-sm text-center">{error}</p>}

              <button
                type="button"
                onClick={() => { setIsRecovering(true); setError(null); setRecoveryMessage(null); }}
                className="block w-full text-right text-xs text-kyo-lightPurple hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>

              <button
                type="submit"
                className={`w-full bg-brand-primary text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(107,98,212,0.3)] transition-all mt-6 ${(!isFormValid || loading) ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                disabled={!isFormValid || loading}
              >
                {loading ? 'Ingresando...' : 'Ingresar'} <ArrowRight size={18} />
              </button>
            </form>

            <div className="w-full flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">o continuar con</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              disabled={true}
              className="w-full bg-white/5 border border-white/5 text-gray-400 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all opacity-50"
            >
              <span className="text-[16px] font-extrabold text-white/40">G</span>
              <span className="text-[14px] font-medium text-white/40">Google (No disponible en Beta)</span>
            </button>

            <p className="text-gray-400 text-sm mt-8 text-center px-4">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-kyo-lightPurple font-bold hover:underline">Regístrate gratis</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
