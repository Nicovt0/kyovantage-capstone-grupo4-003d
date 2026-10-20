import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FeaturesExplorer } from './FeaturesExplorer';
import { Roadmap } from './Roadmap';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { betaCodeAvailable } from '@/features/admin/api/invitations';
import { getAppUrl } from '@/lib/siteUrls';
import {
  Sparkles,
  Lock,
  Users,
  Check,
  X,
  Building2,
  CreditCard,
  PieChart,
  Target,
  ShieldCheck,
  Bot,
  ChevronDown,
  Moon,
  Sun,
  Instagram,
  Wallet,
  CalendarDays,
  Activity,
  Brain,
  Apple,
  Play,
  Star
} from 'lucide-react';
import { Accordion, AccordionItem } from '@/shared/ui/Accordion';
import { AuthLogo } from '@/features/auth/components/AuthLogo';
import { useTheme } from '@/shared/theme/ThemeProvider';

export function LandingPage() {
  const [betaCode, setBetaCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'valid' | 'invalid' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);


  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const activeTesters = 14;
  const maxTesters = 50;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!betaCode.trim()) return;

    setIsVerifying(true);
    setCodeStatus(null);
    setErrorMessage('');

    try {
      const { data, error } = await betaCodeAvailable(betaCode);

      if (error || !data) {
        setCodeStatus('invalid');
        setErrorMessage(error ? 'No se pudo verificar el código. Inténtalo nuevamente.' : 'El código ingresado no está disponible.');
      } else {
        setCodeStatus('valid');
        setTimeout(() => {
          window.location.href = `${getAppUrl()}/register?code=${encodeURIComponent(betaCode.trim().toUpperCase())}`;
        }, 1000);
      }
    } catch (err) {
      setCodeStatus('invalid');
      setErrorMessage('Error de conexión. Inténtalo nuevamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Lead function moved to Footer

  return (
    <div className="min-h-screen bg-white dark:bg-[#06040d] text-gray-900 dark:text-[#f1f0f8] font-sans selection:bg-[#7c3aed]/30 selection:text-[#c4b5fd] overflow-x-hidden relative transition-colors duration-300">
      {/* Noise Overlay Removed for Performance */}

      <Navbar />

      <main className="relative z-10 pt-20">
        {/* HERO OFICIAL */}
        <section className="relative min-h-[95vh] flex flex-col items-center justify-center text-center px-6 pt-[100px] pb-24 overflow-hidden bg-[#06020d]">
          {/* Aurora Background (No blur filters for max performance) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
             <div className="absolute -top-[40%] left-[0%] w-[150%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.12)_0%,_transparent_50%)] animate-pulse" style={{ animationDuration: '8s' }} />
             <div className="absolute top-[20%] -right-[20%] w-[150%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.08)_0%,_transparent_50%)] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
          </div>

          <div className="relative z-10 flex flex-col items-center max-w-5xl mx-auto w-full">
            {/* Logo Kyo Vantage (Full Text) */}
            <div className="mb-8 animate-in fade-in zoom-in-95 duration-700">
               <AuthLogo className="w-[200px] md:w-[250px] h-[50px]" imageClassName="w-[200px] md:w-[250px]" />
            </div>

            {/* Title */}
            <h1 className="text-[36px] sm:text-5xl md:text-[70px] lg:text-[84px] font-extrabold leading-[1.1] tracking-tight md:tracking-[-3px] text-white mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 px-2">
              Domina tu dinero. <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] dark:from-[#9b70f7] dark:via-[#c4b5fd] dark:to-[#e0d7ff]">Conquista tu futuro.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-[16px] md:text-[18px] text-gray-400 font-light max-w-[600px] mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-[1.7] px-4">
              Kyo Vantage no es otro gestor de gastos más. Es tu simulador bancario personal. Construye disciplina financiera hoy para que las instituciones no te rechacen mañana.
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-[500px] mx-auto mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
               <a href={`${getAppUrl()}/register`} className="bg-[#7c3aed] hover:bg-[#9b70f7] text-white rounded-xl py-3.5 px-10 text-[15px] font-bold transition-all shadow-[0_4px_14px_0_rgba(124,58,237,0.39)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.23)] hover:-translate-y-[1px] text-center w-full sm:w-auto">
                  Crea tu cuenta
               </a>
            </div>

            {/* ESTADÍSTICAS DE LA BETA */}
            <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-400">
              {/* Usuarios */}
              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-2">Cupos Disponibles</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-extrabold text-[#7c3aed] tracking-tight">{maxTesters - activeTesters}</span>
                  <span className="text-sm font-medium text-gray-500">/ {maxTesters}</span>
                </div>
              </div>

              {/* Fase */}
              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-2">Fase Actual</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">Cerrada V1</span>
              </div>

              {/* Fecha de Inicio */}
              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-2">Inició en</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">Julio 15</span>
              </div>

              {/* Fecha de Término */}
              <div className="flex flex-col items-center text-center">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-[0.1em] mb-2">Término Est.</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-[#7c3aed] tracking-tight mt-1">Septiembre</span>
              </div>
            </div>

            {/* Download Buttons (Disabled) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-12 duration-700 delay-500">
              <div className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-gray-500 rounded-2xl py-3.5 px-8 font-bold cursor-not-allowed w-full sm:w-auto opacity-60">
                <svg viewBox="0 0 384 512" width="28" height="28" fill="currentColor">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                <div className="text-left flex flex-col">
                  <span className="text-[10px] font-medium leading-none mb-0.5 text-gray-500">Próximamente en</span>
                  <span className="text-[15px] font-black leading-none tracking-tight text-gray-400">App Store</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-gray-500 rounded-2xl py-3.5 px-8 font-bold cursor-not-allowed w-full sm:w-auto opacity-60">
                <Play size={24} className="text-gray-500" fill="currentColor" stroke="none" />
                <div className="text-left flex flex-col">
                  <span className="text-[10px] font-medium leading-none mb-0.5 text-gray-500">Próximamente en</span>
                  <span className="text-[15px] font-black leading-none tracking-tight text-gray-400">Google Play</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* EXPLORADOR DE FUNCIONALIDADES Y PANTALLAS */}
        <FeaturesExplorer />

        {/* ROADMAP INTERACTIVO */}
        <Roadmap />

        {/* EL COMPROMISO KYO (BÚNKER LÓGICO) */}
        <section id="commitment" className="py-32 bg-[#03150a] relative z-10 border-y border-[#10b981]/20 scroll-mt-16">
          {/* Cyber-grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-6 md:px-12 text-center flex flex-col items-center relative z-10">

            {/* Abstract High-Fidelity Shield/Lock Icon */}
            <div className="relative w-40 h-40 mb-10 flex items-center justify-center group">
              <div className="absolute inset-0 border border-[#10b981]/20 rotate-45 scale-75 transition-transform duration-700 group-hover:rotate-90" />
              <div className="absolute inset-0 border border-[#10b981]/20 -rotate-45 scale-75 transition-transform duration-700 group-hover:-rotate-90" />
              <svg width="100" height="110" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
                <path d="M50 2L95 25V85L50 108L5 85V25L50 2Z" fill="#020b06" stroke="#10b981" strokeWidth="2" strokeLinejoin="miter" />
                <path d="M50 18L78 32V78L50 92L22 78V32L50 18Z" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 4" />
                <path d="M40 45V40C40 34.5 44.5 30 50 30C55.5 30 60 34.5 60 40V45H65V75H35V45H40ZM45 45H55V40C55 37.2 52.8 35 50 35C47.2 35 45 37.2 45 40V45Z" fill="#10b981" />
              </svg>
            </div>

            <div className="text-[#10b981] font-mono text-xs md:text-sm font-bold tracking-[0.3em] uppercase mb-6 bg-[#10b981]/10 px-4 py-2 border border-[#10b981]/30">
              Seguridad Institucional
            </div>

            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-8 tracking-tight font-sans uppercase">
              El Compromiso Kyo
            </h2>

            <p className="text-lg md:text-2xl text-gray-300 leading-relaxed max-w-4xl mx-auto font-light mb-16">
              Aislamiento estricto y ciego de tu información financiera. Construimos un entorno encriptado donde <span className="text-white font-semibold">tú eres el único dueño de tus datos.</span>
            </p>

            {/* Straight-edged robust grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 w-full border border-[#10b981]/20 bg-[#051c0d]">
              <div className="text-left p-8 md:p-10 border-b md:border-b-0 md:border-r border-[#10b981]/20 hover:bg-[#10b981]/10 transition-colors duration-300">
                <ShieldCheck size={32} className="text-[#10b981] mb-6" strokeWidth={1.5} />
                <h3 className="text-white font-bold text-lg mb-3 tracking-wide uppercase text-sm">Cero Comercialización</h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">Jamás venderemos ni compartiremos tus datos. Tu información es sagrada y no es nuestro modelo de negocio bajo ningún caso.</p>
              </div>
              <div className="text-left p-8 md:p-10 border-b md:border-b-0 md:border-r border-[#10b981]/20 hover:bg-[#10b981]/10 transition-colors duration-300">
                <Brain size={32} className="text-[#10b981] mb-6" strokeWidth={1.5} />
                <h3 className="text-white font-bold text-lg mb-3 tracking-wide uppercase text-sm">Entrenamiento Privado</h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">Tus datos se usan exclusivamente en entornos aislados para entrenar y refinar los modelos predictivos de tu propia cuenta.</p>
              </div>
              <div className="text-left p-8 md:p-10 hover:bg-[#10b981]/10 transition-colors duration-300">
                <X size={32} className="text-[#10b981] mb-6" strokeWidth={1.5} />
                <h3 className="text-white font-bold text-lg mb-3 tracking-wide uppercase text-sm">Eliminación Absoluta</h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">Tienes el control total. Si decides irte, purgamos permanentemente toda tu información de nuestros servidores sin dejar rastro.</p>
              </div>
            </div>

          </div>
        </section>

        {/* PREGUNTAS FRECUENTES */}
        <section id="faq" className="py-24 bg-[#06020d] relative z-10 scroll-mt-16 border-t border-white/5">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
             <div className="absolute bottom-[0%] left-[50%] -translate-x-1/2 w-[100%] h-[100%] bg-[radial-gradient(ellipse_at_bottom,_rgba(124,58,237,0.08)_0%,_transparent_60%)]" />
          </div>
          <div className="max-w-3xl mx-auto px-6 md:px-12 relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
                Preguntas <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7c3aed] to-[#06b6d4]">Frecuentes</span>
              </h2>
              <p className="text-gray-400 text-lg font-light">
                Todo lo que necesitas saber antes de empezar tu entrenamiento.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-2 md:p-4 backdrop-blur-sm">
              <Accordion>
                <AccordionItem title="¿Qué es exactamente Kyo Vantage?">
                  Kyo Vantage no es simplemente un lugar para anotar lo que gastas. Es un simulador financiero personal diseñado para ayudarte a construir disciplina. La aplicación te evalúa, gestiona tus presupuestos y te "cobra" tus ahorros como si fuera una institución bancaria real, preparándote para el mundo financiero.
                </AccordionItem>
                <AccordionItem title="¿Tienen acceso a mi cuenta bancaria real?">
                  No, en absoluto. Kyo Vantage funciona de manera 100% independiente para proteger tu privacidad. No nos conectamos a tus cuentas de banco ni te pedimos tus claves bancarias. Tú registras y gestionas tus movimientos de manera manual o a través de nuestra agenda inteligente.
                </AccordionItem>
                <AccordionItem title="¿Cómo funciona la etapa de Beta Cerrada?">
                  Actualmente estamos en una fase de prueba exclusiva. Solo estamos aceptando un grupo limitado de evaluadores (testers) para perfeccionar la aplicación antes del lanzamiento global. Si tienes un código de invitación, puedes registrarte de inmediato y asegurar tu cupo.
                </AccordionItem>
                <AccordionItem title="¿Qué son los aportes con cobro automático?">
                  Es una de nuestras funciones estrella. Puedes configurar metas de ahorro y la aplicación agendará automáticamente un "cobro" mensual. Esto simula el pago de un crédito real, ayudándote a priorizar el ahorro como si fuera una obligación financiera ineludible.
                </AccordionItem>
                <AccordionItem title="¿Tendrá algún costo usar la aplicación?">
                  Kyo Vantage será completamente gratis en todas sus funcionalidades esenciales para siempre. En el futuro, ofreceremos planes premium (Kyo Pro) con herramientas avanzadas como la IA de Kyo Advisor, pero la gestión básica de tu dinero nunca tendrá costo.
                </AccordionItem>
                <AccordionItem title="¿Qué pasará cuando terminen los cupos de la Beta?">
                  Una vez que alcancemos nuestro límite de evaluadores (testers), cerraremos los registros temporalmente. Sin embargo, puedes dejarnos tu correo en la lista de espera (al final de esta página) y serás el primero en enterarte cuando abramos nuevos cupos o lancemos la versión pública.
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
