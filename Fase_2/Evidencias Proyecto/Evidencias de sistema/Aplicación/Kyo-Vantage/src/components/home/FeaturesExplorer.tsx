import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Brain, Zap, Target, Wallet, PieChart, CalendarDays, CreditCard, Sparkles, ArrowRight, TrendingDown } from 'lucide-react';

const FEATURES = [
  {
    id: 'wallet',
    title: 'Billetera Inteligente',
    icon: Wallet,
    description: 'Registra tus ingresos y gastos al instante. Conoce exactamente cuánto dinero tienes disponible en todo momento sin esfuerzo.',
  },
  {
    id: 'budget',
    title: 'Presupuestos',
    icon: PieChart,
    description: 'Asigna límites mensuales a tus categorías. Te avisaremos antes de que te pases de la raya para mantener tu plan intacto.',
  },
  {
    id: 'goals',
    title: 'Metas de Ahorro',
    icon: Target,
    description: 'Crea objetivos con fecha límite. Visualiza tu progreso y aporta automáticamente para no perder el foco de tu futuro.',
  },
  {
    id: 'calendar',
    title: 'Agenda Financiera',
    icon: CalendarDays,
    description: 'Un calendario integrado que consolida tus cobros de metas, presupuestos y gastos recurrentes para que nunca te sorprenda un pago.',
  },
  {
    id: 'credit',
    title: 'Tarjetas de Crédito',
    icon: CreditCard,
    description: 'Lleva el control de tus fechas de facturación, cupos disponibles y cuotas pendientes para evitar intereses y mantener un historial impecable.',
  },
  {
    id: 'score',
    title: 'Kyo Score',
    icon: Activity,
    description: 'Tu reputación financiera en un solo número. Simulamos el escrutinio bancario para darte un puntaje real basado en tu disciplina.',
    isUpcoming: true
  },
  {
    id: 'advisor',
    title: 'Kyo Advisor IA',
    icon: Brain,
    description: 'Análisis automatizado que genera sugerencias y alertas proactivas para optimizar tus gastos y maximizar tus ahorros sin esfuerzo.',
    isUpcoming: true
  }
];

export function FeaturesExplorer() {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0].id);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // Only apply Intersection Observer on mobile devices (where horizontal scroll exists)
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = entry.target.getAttribute('data-id');
            if (id) setActiveFeature(id);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5,
        rootMargin: '0px'
      }
    );

    nodeRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 bg-[#0a0514] relative z-10 border-t border-[#7c3aed]/20 overflow-hidden">
      {/* Background Glows (Replaced blur with radial gradients for performance) */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.08)_0%,_transparent_60%)] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,_rgba(6,182,212,0.08)_0%,_transparent_60%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Todo lo que necesitas para tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#06b6d4] to-[#d946ef]">libertad financiera</span>
          </h2>
          <p className="text-[#a0a0b8] text-lg max-w-3xl mx-auto font-light leading-relaxed">
            Diseñado para que tomes el control de tus finanzas hoy. Selecciona una función para descubrir cómo nuestra tecnología hace que tus finanzas cobren vida.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 lg:hidden text-gray-500 text-sm font-medium animate-pulse">
            <ArrowRight size={16} className="rotate-180" />
            <span>Desliza para explorar</span>
            <ArrowRight size={16} />
          </div>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-16 items-start mt-8 relative">
          
          {/* LEFT: TITLES */}
          <div 
            ref={containerRef}
            className="lg:col-span-5 flex flex-row lg:flex-col gap-4 lg:gap-3 w-full h-auto lg:h-[600px] overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto hide-scrollbar pb-6 snap-x snap-mandatory px-4 lg:px-0 lg:pr-2"
          >
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = activeFeature === feature.id;
              
              return (
                <button
                  key={feature.id}
                  ref={(el) => { nodeRefs.current[index] = el; }}
                  data-id={feature.id}
                  onClick={() => {
                    setActiveFeature(feature.id);
                    nodeRefs.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`text-left p-5 md:p-6 rounded-3xl transition-all duration-300 relative group overflow-hidden flex-shrink-0 w-[85vw] max-w-[320px] lg:w-full lg:max-w-none snap-center ${
                    isActive 
                      ? 'bg-[#150a2b] border border-[#7c3aed]/50 shadow-[0_0_20px_rgba(124,58,237,0.15)]' 
                      : 'bg-transparent border border-transparent hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="activeFeatureBg" 
                      className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/10 to-transparent pointer-events-none"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {feature.isUpcoming && (
                    <div className="absolute top-4 right-4 bg-white/10 text-gray-400 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Pronto
                    </div>
                  )}
                  <div className="relative z-10 flex items-start gap-4">
                    <div className={`mt-0.5 p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-[#06b6d4]/20 to-[#d946ef]/20 text-[#06b6d4] shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-white/5 text-gray-500 group-hover:text-[#a0a0b8]'}`}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <div className="pr-12">
                      <h3 className={`text-lg md:text-xl font-bold mb-1 transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        {feature.title}
                      </h3>
                      <AnimatePresence>
                        {isActive && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="text-[#a0a0b8] text-sm leading-relaxed"
                          >
                            {feature.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT: MOCKUPS */}
          <div className="lg:col-span-7 relative h-[380px] lg:h-[600px] w-full flex items-center justify-center sticky top-24 lg:static z-20">
             <AnimatePresence mode="wait">
                {activeFeature === 'wallet' && <WalletMockup key="wallet" />}
                {activeFeature === 'budget' && <BudgetMockup key="budget" />}
                {activeFeature === 'goals' && <GoalsMockup key="goals" />}
                {activeFeature === 'calendar' && <CalendarMockup key="calendar" />}
                {activeFeature === 'credit' && <CreditMockup key="credit" />}
                {activeFeature === 'score' && <ScoreMockup key="score" />}
                {activeFeature === 'advisor' && <AdvisorMockup key="advisor" />}
             </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}

// --- MOCKUP COMPONENTS ---

function WalletMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-6 relative overflow-hidden"
    >
       <h4 className="text-gray-400 font-medium mb-2 text-sm text-center mt-2">Saldo Total</h4>
       <div className="text-4xl font-black text-white text-center mb-8">$2,450.00</div>
       
       <div className="flex gap-4 mb-8">
         <button className="flex-1 bg-[#7c3aed] text-white py-3 rounded-2xl text-xs font-bold shadow-[0_4px_15px_rgba(124,58,237,0.3)]">Ingreso</button>
         <button className="flex-1 bg-[#1e1b30] text-white py-3 rounded-2xl text-xs font-bold">Gasto</button>
       </div>

       <div className="space-y-3">
         <div className="text-white font-bold text-xs mb-3">Movimientos Recientes</div>
         <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-[#150a2b] p-4 rounded-2xl flex justify-between items-center border border-white/5">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center"><TrendingDown size={18} /></div>
             <div><p className="text-white text-sm font-bold">Netflix</p><p className="text-gray-500 text-[10px]">Suscripciones</p></div>
           </div>
           <span className="text-red-400 font-bold text-sm">-$15.99</span>
         </motion.div>
         <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-[#150a2b] p-4 rounded-2xl flex justify-between items-center border border-white/5">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center"><ArrowRight size={18} className="rotate-45" /></div>
             <div><p className="text-white text-sm font-bold">Sueldo</p><p className="text-gray-500 text-[10px]">Ingresos</p></div>
           </div>
           <span className="text-emerald-400 font-bold text-sm">+$2,400.00</span>
         </motion.div>
       </div>
    </motion.div>
  );
}

function BudgetMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-6 relative overflow-hidden"
    >
      <h4 className="text-white font-bold text-lg mb-6">Presupuestos</h4>
      
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-[#150a2b] p-5 rounded-3xl border border-[#d946ef]/30 shadow-[0_0_20px_rgba(217,70,239,0.1)] relative overflow-hidden mb-4">
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[radial-gradient(circle_at_center,_rgba(217,70,239,0.15)_0%,_transparent_60%)] rounded-full" />
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-bold">Alimentación</span>
          <span className="text-[#d946ef] font-bold text-xs bg-[#d946ef]/20 px-2 py-1 rounded-md">Alerta</span>
        </div>
        <p className="text-gray-400 text-[11px] mb-4">Has gastado el 85% de tu límite.</p>
        
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white">$340.00</span>
          <span className="text-gray-500">de $400.00</span>
        </div>
        <div className="w-full bg-black/50 rounded-full h-2">
          <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} transition={{ duration: 1, delay: 0.5 }} className="h-full bg-gradient-to-r from-[#7c3aed] to-[#d946ef] rounded-full" />
        </div>
      </motion.div>

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-[#150a2b] p-5 rounded-3xl border border-white/5 relative overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-bold">Transporte</span>
        </div>
        <p className="text-gray-400 text-[11px] mb-4">Vas muy bien este mes.</p>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white">$45.00</span>
          <span className="text-gray-500">de $150.00</span>
        </div>
        <div className="w-full bg-black/50 rounded-full h-2">
          <motion.div initial={{ width: 0 }} animate={{ width: '30%' }} transition={{ duration: 1, delay: 0.6 }} className="h-full bg-[#06b6d4] rounded-full" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function GoalsMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-6 relative overflow-hidden"
    >
       <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[radial-gradient(circle_at_center,_rgba(6,182,212,0.15)_0%,_transparent_60%)] rounded-full" />
       
       <h4 className="text-white font-bold text-lg mb-6">Metas de Ahorro</h4>
       
       <div className="bg-[#150a2b] p-6 rounded-[32px] border border-[#06b6d4]/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-[#06b6d4]/20 flex items-center justify-center text-[#06b6d4] mb-4">
            ✈️
          </div>
          <h5 className="text-white font-bold text-xl mb-1">Viaje a Japón</h5>
          <p className="text-[#06b6d4] text-xs font-bold mb-6 flex items-center gap-1.5"><Zap size={14}/> Cobro Automático el 15</p>

          <div className="flex justify-between text-xs mb-2">
            <span className="text-white font-bold">$1,200</span>
            <span className="text-gray-500">Objetivo: $3,000</span>
          </div>
          <div className="w-full bg-black/50 rounded-full h-2.5 mb-6">
            <motion.div initial={{ width: 0 }} animate={{ width: '40%' }} transition={{ duration: 1.5, type: 'spring' }} className="h-full bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] rounded-full relative">
              <div className="absolute top-0 right-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/30" />
            </motion.div>
          </div>
          
          <button className="w-full bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 text-[#06b6d4] font-bold py-3 rounded-xl transition-colors text-sm">
            Aportar Extra
          </button>
       </div>
    </motion.div>
  );
}

function CalendarMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-6 relative overflow-hidden"
    >
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-white font-bold text-lg">Noviembre</h4>
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-gray-400 text-xs">&lt;</div>
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white text-xs">&gt;</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-gray-500 font-bold mb-3">
        <div>LU</div><div>MA</div><div>MI</div><div>JU</div><div>VI</div><div>SA</div><div>DO</div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium">
        {/* Empty slots */}
        <div className="py-2 text-transparent">28</div>
        <div className="py-2 text-transparent">29</div>
        <div className="py-2 text-transparent">30</div>
        <div className="py-2 text-transparent">31</div>
        {/* Days */}
        {[...Array(14)].map((_, i) => {
          const isToday = i === 10;
          const hasEvent = i === 13;
          return (
            <motion.div 
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`py-2 rounded-xl relative ${isToday ? 'bg-[#7c3aed] text-white' : 'text-gray-300 hover:bg-white/5'}`}
            >
              {i + 1}
              {hasEvent && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#d946ef]" />}
            </motion.div>
          );
        })}
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 bg-[#150a2b] p-4 rounded-2xl border border-[#d946ef]/30 shadow-[0_0_15px_rgba(217,70,239,0.1)]">
        <div className="text-[#d946ef] text-[10px] font-bold uppercase tracking-wider mb-1">Día 14 • Mañana</div>
        <h5 className="text-white font-bold text-sm mb-2">Pago Spotify Premium</h5>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Suscripciones</span>
          <span className="text-white font-bold">-$10.99</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreditMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-6 relative overflow-hidden"
    >
       <h4 className="text-white font-bold text-lg mb-6">Tus Tarjetas</h4>
       
       <motion.div 
         initial={{ rotateY: 90 }} 
         animate={{ rotateY: 0 }} 
         transition={{ duration: 0.8, type: 'spring' }}
         className="w-full h-44 rounded-2xl bg-gradient-to-br from-[#1e1b30] to-[#0A0718] border border-white/10 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden mb-6"
       >
         <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.25)_0%,_transparent_60%)] rounded-full" />
         <div className="flex justify-between items-start relative z-10">
           <div className="w-10 h-6 bg-white/20 rounded-md" />
           <span className="text-white font-bold italic">BANC</span>
         </div>
         <div className="relative z-10">
           <div className="text-gray-400 text-xs mb-1">Cupo Disponible</div>
           <div className="text-white text-2xl font-black">$4,500.00</div>
         </div>
         <div className="flex justify-between items-center text-gray-400 text-[10px] tracking-widest relative z-10">
           <span>**** **** **** 4289</span>
           <span>09/28</span>
         </div>
       </motion.div>

       <div className="bg-[#150a2b] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
         <div>
           <div className="text-gray-400 text-xs mb-1">Deuda actual</div>
           <div className="text-white font-bold">$340.00</div>
         </div>
         <div className="text-right">
           <div className="text-[#06b6d4] text-[10px] font-bold mb-1">Pago el 25/11</div>
           <button className="bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/20 transition-colors">Pagar</button>
         </div>
       </div>
    </motion.div>
  );
}

function ScoreMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-8 relative overflow-hidden flex flex-col items-center justify-center text-center"
    >
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-[radial-gradient(circle_at_center,_rgba(217,70,239,0.15)_0%,_transparent_60%)] rounded-full pointer-events-none" />
       
       <h4 className="text-gray-300 font-semibold mb-8 relative z-10 text-lg">Tu Kyo Score Actual</h4>
       
       <div className="relative w-48 h-48 flex items-center justify-center mb-10">
         {/* Outer Ring */}
         <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="96" cy="96" r="88" fill="none" stroke="#1e1b30" strokeWidth="8" />
            <motion.circle 
              cx="96" cy="96" r="88" 
              fill="none" 
              stroke="url(#score-gradient)" 
              strokeWidth="8" 
              strokeLinecap="round"
              strokeDasharray="553"
              initial={{ strokeDashoffset: 553 }}
              animate={{ strokeDashoffset: 553 * (1 - 0.85) }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            />
            <defs>
              <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#d946ef" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
         </svg>
         
         <div className="relative z-10 flex flex-col items-center">
            <motion.span 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: 'spring', bounce: 0.5 }}
              className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-sm"
            >
              850
            </motion.span>
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="text-[#06b6d4] text-sm font-bold mt-2 uppercase tracking-widest shadow-[#06b6d4]"
            >
              Excelente
            </motion.span>
         </div>
       </div>

       <div className="w-full bg-[#150a2b] rounded-3xl p-5 border border-white/5 text-left flex gap-4 items-start relative z-10 shadow-lg">
          <div className="p-3 bg-[#d946ef]/20 rounded-xl text-[#d946ef] shadow-[0_0_15px_rgba(217,70,239,0.3)]">
            <Zap size={20} />
          </div>
          <div>
            <p className="text-white text-sm font-bold mb-1">Aprobación Asegurada</p>
            <p className="text-gray-400 text-xs leading-relaxed">Tu disciplina actual garantiza las mejores tasas del mercado.</p>
          </div>
       </div>
    </motion.div>
  );
}

function AdvisorMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
      className="w-full max-w-[340px] bg-[#0A0718] border border-[#1e1b30] rounded-[40px] p-6 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.15)_0%,_transparent_60%)] rounded-full pointer-events-none" />

      <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-5 relative z-10">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#d946ef] flex items-center justify-center p-[2px] shadow-[0_0_20px_rgba(124,58,237,0.4)]">
          <div className="w-full h-full bg-[#0A0718] rounded-full flex items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-[#d946ef]/10 animate-pulse" />
             <Brain size={22} className="text-[#d946ef] relative z-10" />
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold text-lg">Kyo Advisor <Sparkles size={14} className="inline text-[#d946ef] mb-1" /></h4>
          <span className="text-xs text-[#06b6d4] font-medium flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 bg-[#06b6d4] rounded-full animate-pulse" /> Análisis Inteligente Activo
          </span>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        
        {/* Insight Card 1 */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-[#d946ef]/10 to-[#7c3aed]/10 border border-[#d946ef]/30 p-4 rounded-2xl shadow-[0_0_15px_rgba(217,70,239,0.1)]"
        >
          <h5 className="text-[#d946ef] font-bold text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Zap size={14} /> Alerta de Presupuesto
          </h5>
          <p className="text-gray-200 text-xs leading-relaxed mb-3">
            Estás gastando un <strong className="text-white">25% más rápido</strong> en "Comida" este mes. Si mantienes este ritmo, superarás el límite en 6 días.
          </p>
          <button className="bg-[#d946ef]/20 text-[#d946ef] px-3 py-2 rounded-xl text-[11px] font-bold w-full hover:bg-[#d946ef]/40 transition-colors">
            Ajustar Presupuesto
          </button>
        </motion.div>

        {/* Insight Card 2 */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#150a2b] border border-white/5 p-4 rounded-2xl"
        >
          <h5 className="text-[#06b6d4] font-bold text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Target size={14} /> Oportunidad de Ahorro
          </h5>
          <p className="text-gray-400 text-xs leading-relaxed">
            Tienes <strong className="text-white">$200.00</strong> inactivos. Podrías destinarlos a tu meta "Viaje a Japón" para completarla 1 mes antes.
          </p>
        </motion.div>

      </div>
    </motion.div>
  );
}
