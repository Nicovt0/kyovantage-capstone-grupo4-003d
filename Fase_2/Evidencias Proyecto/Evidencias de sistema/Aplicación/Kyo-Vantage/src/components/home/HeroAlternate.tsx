import React from 'react';
import { Star, Apple, Play } from 'lucide-react';

export function HeroAlternate() {
  return (
    <section className="relative min-h-[95vh] flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden bg-[#06020d] border-t border-white/5 mt-8">
      {/* Aurora Background (No blur filters for max performance) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         {/* Top Purple Glow */}
         <div className="absolute -top-[40%] left-[0%] w-[150%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.12)_0%,_transparent_50%)] animate-pulse" style={{ animationDuration: '8s' }} />
         {/* Bottom Cyan Glow */}
         <div className="absolute top-[20%] -right-[20%] w-[150%] h-[120%] bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.08)_0%,_transparent_50%)] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto w-full">
        {/* Logo */}
        <div className="mb-10 animate-in fade-in zoom-in-95 duration-700">
          <img src="/VANTAGE.png" alt="Kyo Vantage Logo" width={80} height={80} className="w-[64px] h-auto" fetchPriority="high" />
        </div>

        {/* Social Proof */}
        <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 mb-8 bg-white/5 border border-white/10 rounded-full px-5 py-2.5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
           <div className="flex items-center gap-1">
             {[1,2,3,4,5].map((i) => (
               <Star key={i} size={16} className="fill-[#FFB800] text-[#FFB800]" />
             ))}
           </div>
           <div className="w-1 h-1 bg-white/30 rounded-full hidden md:block" />
           <span className="text-white text-sm font-medium tracking-wide">
             <span className="font-bold">4.8/5</span> en base a <span className="font-bold">1.500+</span> estudiantes entrenando
           </span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-white mb-8 max-w-4xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
          El entrenador financiero que te evalúa <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7c3aed] to-[#06b6d4]">como un banco lo haría.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 font-light max-w-2xl mx-auto mb-14 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 leading-relaxed">
          Diseñado para que tomes el control de tus finanzas hoy. Construye tu reputación, maximiza tu puntaje y asegura tu futuro financiero.
        </p>

        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500">
           <a href="#" className="flex items-center justify-center gap-3 bg-white text-black rounded-2xl py-3.5 px-6 font-bold hover:bg-gray-200 transition-transform hover:scale-[1.02] active:scale-95 w-full sm:w-auto">
             <Apple size={28} className="fill-black" />
             <div className="text-left flex flex-col">
               <span className="text-[10px] font-medium leading-none mb-0.5 text-gray-600">Consíguelo en el</span>
               <span className="text-[15px] font-black leading-none tracking-tight">App Store</span>
             </div>
           </a>
           <a href="#" className="flex items-center justify-center gap-3 bg-[#151520] border border-white/10 text-white rounded-2xl py-3.5 px-6 font-bold hover:bg-[#1a1a2e] transition-transform hover:scale-[1.02] active:scale-95 w-full sm:w-auto">
             <Play size={24} className="fill-white" />
             <div className="text-left flex flex-col">
               <span className="text-[10px] font-medium leading-none mb-0.5 text-gray-400">DISPONIBLE EN</span>
               <span className="text-[15px] font-black leading-none tracking-tight">Google Play</span>
             </div>
           </a>
        </div>
      </div>
    </section>
  );
}
