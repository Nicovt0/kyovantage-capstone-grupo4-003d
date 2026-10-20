import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { AuthLogo } from '@/features/auth/components/AuthLogo';
import { createClient } from '@/utils/supabase/client';
import { betaCodeAvailable } from '@/features/admin/api/invitations';

export function RegisterScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [betaCode, setBetaCode] = useState(() => new URLSearchParams(window.location.search).get('code') ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const regexContrasenaEstricta = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+=\-[\]{};':"|<>?,./~.]{8,}$/;

  const isFormValid = useMemo(() => {
    return name.trim() !== '' &&
           isEmailValid &&
           regexContrasenaEstricta.test(password) &&
           password === confirmPassword &&
           betaCode.trim().length >= 6;
  }, [name, isEmailValid, password, confirmPassword, betaCode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data: available, error: betaError } = await betaCodeAvailable(betaCode, email);
      if (betaError || !available) throw new Error(betaError ? 'No se pudo verificar la invitación. Inténtalo nuevamente.' : 'El código no está disponible para este correo o ya fue utilizado.');
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { name: name.trim(), full_name: name.trim(), first_name: name.trim(), beta_code: betaCode.trim().toUpperCase() } },
      });
      if (signUpError) throw new Error(signUpError.message);
      // The database consumes the code in the same transaction as the Auth user.
      setIsRegistered(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear tu cuenta. Inténtalo nuevamente.');
    } finally { setLoading(false); }
  };
  const handleGoogleRegister = async () => {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: oAuthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (oAuthError) {
      setError(oAuthError.message);
      setLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-kyo-dark p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-kyo-purple/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-kyo-lightPurple/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="z-10 w-full max-w-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#5DCAA5]/10 border border-[#5DCAA5]/30 flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-[#5DCAA5]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Revisa tu correo</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Hemos enviado un enlace de confirmación a <strong className="text-kyo-lightPurple">{email}</strong>. Ábrelo para activar tu cuenta.
          </p>
          <Link to="/" className="w-full bg-white text-gray-900 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center hover:scale-[1.02] transition-all">
            Volver a inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-kyo-dark p-6 relative overflow-hidden">
      {/* Background glow for aesthetic */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-kyo-purple/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-kyo-lightPurple/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-sm flex flex-col items-center">
        <h1 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4 text-left w-full ml-1">
          Crea tu cuenta
        </h1>

        {error && <p className="text-[#E24B4A] text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleRegister} className="w-full space-y-4 mb-6">
          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1" htmlFor="register-name">Nombre o apodo</label>
              <input
                type="text"
                id="register-name"
                autoComplete="nickname"
                required
                placeholder="Nombre de usuario"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-kyo-lightPurple focus:bg-white/10 transition-all text-[15px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

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
                type={showPassword ? "text" : "password"}
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
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {password.length > 0 && !regexContrasenaEstricta.test(password) ? (
              <p className="text-[11px] text-[#E24B4A] ml-1 leading-tight mt-1.5">
                La contraseña debe tener al menos 8 caracteres, incluir una mayúscula, una minúscula y un número.
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 ml-1 mt-1.5">Mínimo 8 caracteres</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Repetir Contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-kyo-lightPurple focus:bg-white/10 transition-all text-[15px] pr-12"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-[11px] text-[#E24B4A] ml-1 mt-1">Las contraseñas no coinciden</p>
            )}
          </div>

          <div className="space-y-1.5 mt-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Código de Invitación (Beta)</label>
            <input
              type="text"
              placeholder="KYO-TEST-XXXX"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 outline-none focus:border-kyo-lightPurple focus:bg-white/10 transition-all text-[15px] uppercase font-mono"
              value={betaCode}
              onChange={(e) => setBetaCode(e.target.value)}
              disabled={loading}
              maxLength={48}
            />
          </div>

          <button
            type="submit"
            className={`w-full bg-brand-primary text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(107,98,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all mt-6 ${(!isFormValid || loading) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            disabled={!isFormValid || loading}
          >
            {loading ? 'Registrando...' : 'Comenzar'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="w-full flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">o continuar con</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <button
          type="button"
          disabled={true}
          className="w-full bg-white/5 border border-white/5 text-gray-400 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all opacity-50 cursor-not-allowed"
        >
          <span className="text-[16px] font-extrabold text-white/40">G</span>
          <span className="text-[14px] font-medium text-white/40">Google (No disponible en Beta)</span>
        </button>

        <p className="text-gray-400 text-sm mt-8 text-center px-4">
          ¿Ya tienes cuenta? <Link to="/" className="text-kyo-lightPurple font-bold hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
