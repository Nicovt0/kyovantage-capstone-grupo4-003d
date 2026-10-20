import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, EyeOff, Check, Eye, KeyRound, Sparkles } from 'lucide-react';
import { AuthLogo } from '@/features/auth/components/AuthLogo';
import { createClient } from '@/utils/supabase/client';
import { ensureCashAccount } from '@/features/wallet/api/accountRepository';
import { useNavigate } from 'react-router-dom';

export default function ActualizarPasswordScreen() {
  const navigate = useNavigate();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if there is an active code/token exchange happening in the URL
    const hasCode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code');
    const hasHash = typeof window !== 'undefined' && window.location.hash.includes('access_token');
    
    if (hasCode || hasHash) {
      console.log('Detected active auth session recovery params in URL. Waiting for session...');
      // Wait for onAuthStateChange to confirm the session instead of redirecting immediately
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
        console.log('actualizar-password auth event:', event, session ? 'Session found' : 'No session');
        if (session) {
          setCheckingSession(false);
        } else if (event === 'SIGNED_OUT') {
          navigate('/login');
        }
      });
      
      // Safety timeout: if after 5 seconds nothing happens, check session and redirect if missing
      const timeout = setTimeout(() => {
        supabase.auth.getSession().then((res: any) => {
          const session = res.data?.session;
          if (!session) {
            navigate('/login');
          } else {
            setCheckingSession(false);
          }
        });
      }, 5000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    } else {
      // Normal flow: verify session immediately
      const checkSession = async () => {
        const res: any = await supabase.auth.getSession();
        const session = res.data?.session;
        if (!session) {
          navigate('/login');
        } else {
          setCheckingSession(false);
        }
      };
      checkSession();
    }
  }, [navigate, supabase]);

  const strength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthLabel = useMemo(() => {
    switch (strength) {
      case 0: return 'Contraseña vacía';
      case 1: return 'Contraseña muy débil';
      case 2: return 'Contraseña débil';
      case 3: return 'Contraseña aceptable';
      case 4: return 'Contraseña muy segura';
      default: return '';
    }
  }, [strength]);

  const strengthColor = useMemo(() => {
    switch (strength) {
      case 1: return '#E24B4A';
      case 2: return '#F79E1B';
      case 3: return '#5DCAA5';
      case 4: return '#5DCAA5';
      default: return 'rgba(255,255,255,0.1)';
    }
  }, [strength]);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  const isFormValid = useMemo(() => {
    const contrasenasCoinciden = password === confirmPassword;
    const cumpleRequisitosSeguridad = hasMinLength && hasUppercase && hasLowercase && hasNumber;
    return contrasenasCoinciden && cumpleRequisitosSeguridad;
  }, [password, confirmPassword, hasMinLength, hasUppercase, hasLowercase, hasNumber]);

  if (checkingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-kyo-dark p-6 relative overflow-hidden">
        {/* Background glow for aesthetic */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-kyo-purple/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-kyo-lightPurple/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="text-gray-400 text-sm animate-pulse z-10">Verificando sesión...</div>
      </div>
    );
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Asegurarse de crear la cuenta en efectivo para el usuario
    try {
      await ensureCashAccount();
    } catch (err) {
      console.error('Error al asegurar la cuenta de efectivo:', err);
    }

    setSuccess(true);
    setLoading(false);
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');

  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-kyo-dark p-6 relative overflow-hidden">
      {/* Background glow for aesthetic */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-kyo-purple/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-kyo-lightPurple/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 mt-12">
          <AuthLogo />
        </div>

        {success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[#5DCAA5]/10 border border-[#5DCAA5]/30 flex items-center justify-center mb-6 animate-pulse">
              <Check className="w-8 h-8 text-[#5DCAA5]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 text-center">¡Contraseña actualizada!</h1>
            <p className="text-gray-400 text-sm mb-10 text-center px-4">
              Tu contraseña ha sido restablecida con éxito. Ya puedes ingresar de forma segura.
            </p>

            <button 
              onClick={handleGoToDashboard}
              className="w-full bg-brand-primary text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(107,98,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Ir al Dashboard <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2 text-center">Nueva contraseña</h1>
            <p className="text-gray-400 text-sm mb-10 text-center">
              Elige una contraseña segura para tu cuenta.
            </p>

            {error && <p className="text-[#E24B4A] text-sm mb-4 text-center">{error}</p>}

            <form onSubmit={handleUpdatePassword} className="w-full space-y-4 mb-6">
              <div className="space-y-1.5 w-full">
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
                
                {/* Strength Indicator */}
                <div className="mt-2 px-1">
                  <div className="flex gap-1 mb-1.5">
                    <div className={`flex-1 h-1 rounded-full bg-white/10 ${strength >= 1 ? '!bg-[#5DCAA5]' : ''}`} style={{ backgroundColor: strength >= 1 ? strengthColor : '' }}></div>
                    <div className={`flex-1 h-1 rounded-full bg-white/10 ${strength >= 2 ? '!bg-[#5DCAA5]' : ''}`} style={{ backgroundColor: strength >= 2 ? strengthColor : '' }}></div>
                    <div className={`flex-1 h-1 rounded-full bg-white/10 ${strength >= 3 ? '!bg-[#5DCAA5]' : ''}`} style={{ backgroundColor: strength >= 3 ? strengthColor : '' }}></div>
                    <div className={`flex-1 h-1 rounded-full bg-white/10 ${strength >= 4 ? '!bg-[#5DCAA5]' : ''}`} style={{ backgroundColor: strength >= 4 ? strengthColor : '' }}></div>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-500" style={{ color: strength > 0 ? strengthColor : '' }}>
                    {strengthLabel}
                  </div>
                  
                  {password.length > 0 && (
                    <div className="flex flex-col gap-1 mt-3 mb-1">
                      <div className={`text-[10px] flex items-center gap-1.5 ${hasMinLength ? 'text-[#5DCAA5]' : 'text-gray-500'}`}>
                        {hasMinLength ? <Check className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-500 ml-1 mr-1"></div>} Al menos 8 caracteres
                      </div>
                      <div className={`text-[10px] flex items-center gap-1.5 ${hasUppercase ? 'text-[#5DCAA5]' : 'text-gray-500'}`}>
                        {hasUppercase ? <Check className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-500 ml-1 mr-1"></div>} Una letra mayúscula
                      </div>
                      <div className={`text-[10px] flex items-center gap-1.5 ${hasLowercase ? 'text-[#5DCAA5]' : 'text-gray-500'}`}>
                        {hasLowercase ? <Check className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-500 ml-1 mr-1"></div>} Una letra minúscula
                      </div>
                      <div className={`text-[10px] flex items-center gap-1.5 ${hasNumber ? 'text-[#5DCAA5]' : 'text-gray-500'}`}>
                        {hasNumber ? <Check className="w-3 h-3" /> : <div className="w-1 h-1 rounded-full bg-gray-500 ml-1 mr-1"></div>} Un número
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 w-full mt-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">Confirmar contraseña</label>
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
                {password && confirmPassword && (
                  <div className="mt-1.5 px-1">
                    {password === confirmPassword ? (
                      <span className="text-[11px] text-[#5DCAA5] font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Las contraseñas coinciden
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#E24B4A] font-semibold">
                        Las contraseñas no coinciden
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button 
                type="submit"
                className={`w-full bg-brand-primary text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(107,98,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all mt-8 ${(!isFormValid || loading) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                disabled={!isFormValid || loading}
              >
                {loading ? 'Actualizando...' : 'Actualizar contraseña'} <ArrowRight size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
