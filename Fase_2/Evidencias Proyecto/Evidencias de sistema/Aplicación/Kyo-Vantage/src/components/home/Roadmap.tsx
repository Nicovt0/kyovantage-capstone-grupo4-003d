import React, { useState, useEffect, useRef } from 'react';

const PHASES = [
  {
    id: 1,
    title: 'Fase 1: Beta Cerrada',
    status: 'Actual',
    milestones: [
      'Billetera Inteligente (MVP)',
      'Gestión de Presupuestos',
      'Infraestructura Core Segura'
    ]
  },
  {
    id: 2,
    title: 'Fase 2: Expansión Analítica',
    status: 'En Desarrollo',
    milestones: [
      'Lanzamiento Público',
      'Agenda Financiera Integrada',
      'Dashboard Predictivo Básico'
    ]
  },
  {
    id: 3,
    title: 'Fase 3: Inteligencia Activa',
    status: 'Q3 2026',
    milestones: [
      'Lanzamiento de Kyo Score',
      'Kyo Advisor (Alertas Inteligentes)',
      'Sincronización de Tarjetas'
    ]
  },
  {
    id: 4,
    title: 'Fase 4: Open Banking',
    status: 'Q1 2027',
    milestones: [
      'Integración Bancaria Total',
      'Automatización de Ahorros',
      'Ecosistema de Inversión Pasiva'
    ]
  }
];

export function Roadmap() {
  const [activeNode, setActiveNode] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = Number(entry.target.getAttribute('data-id'));
            if (id) setActiveNode(id);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5,
        rootMargin: '0px -45% 0px -45%' // Solo detecta cuando el nodo está en el centro de la pantalla
      }
    );

    nodeRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="roadmap" className="py-24 bg-black relative z-10 border-t border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-10 md:mb-0">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Nuestra <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7c3aed] to-[#06b6d4]">Hoja de Ruta</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light leading-relaxed">
            Desde los cimientos del control financiero hasta la automatización total con Open Banking. Conoce hacia dónde se dirige Kyo Vantage.
          </p>
        </div>

        {/* Scroll Container within Max Width */}
        <div className="relative w-full mt-4 md:mt-10">
          {/* Fade Edges for smoother scrolling appearance */}
          <div className="absolute top-0 left-0 bottom-0 w-8 md:w-16 bg-gradient-to-r from-black to-transparent z-30 pointer-events-none" />
          <div className="absolute top-0 right-0 bottom-0 w-8 md:w-16 bg-gradient-to-l from-black to-transparent z-30 pointer-events-none" />

          {/* Horizontal Scroll Area */}
          <div 
            ref={containerRef}
            className="w-full overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing snap-x snap-mandatory pt-16 pb-16 md:pt-24 md:pb-40 relative scroll-smooth"
          >
            
            <div className="relative flex items-center gap-48 md:gap-56 h-[350px] w-max px-[calc(50%-12px)]">
              
              {/* Central Line */}
              <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-[#7c3aed] via-[#d946ef] to-[#06b6d4] top-1/2 -translate-y-1/2 opacity-70" />
              
              {PHASES.map((phase, index) => {
                const isActive = activeNode === phase.id;

                return (
                  <div 
                    key={phase.id}
                    ref={(el) => { nodeRefs.current[index] = el; }}
                    data-id={phase.id}
                    className="roadmap-node relative flex flex-col items-center shrink-0 snap-center cursor-pointer group"
                    onClick={(e) => {
                      setActiveNode(phase.id);
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }}
                  >
                    {/* Interaction Area (Invisible padding for easier hover/touch) */}
                    <div className="absolute inset-[-80px] z-10" />

                    {/* Node Circle */}
                    <div 
                      className={`w-6 h-6 rounded-full border-[3px] z-20 transition-all duration-500 ease-out ${
                        isActive 
                          ? 'scale-[1.4] bg-[#06b6d4] border-[#06b6d4]' 
                          : 'bg-black border-[#7c3aed] group-hover:border-[#d946ef] group-hover:scale-110'
                      }`} 
                    />

                    {/* Title Box (Top) */}
                    <div 
                      className={`absolute bottom-12 w-56 md:w-64 transition-all duration-700 ease-out flex flex-col items-center text-center ${
                        isActive 
                          ? 'opacity-100 translate-y-0 pointer-events-auto' 
                          : 'opacity-30 md:opacity-0 pointer-events-none translate-y-8'
                      }`}
                    >
                      <div className={`text-[10px] md:text-xs uppercase font-bold tracking-widest mb-2 transition-colors duration-500 ${isActive ? 'text-[#06b6d4]' : 'text-[#7c3aed]'}`}>
                        {phase.status}
                      </div>
                      <h4 className={`font-bold text-xl md:text-2xl transition-colors duration-500 ${isActive ? 'text-white' : 'text-gray-500'}`}>
                        {phase.title}
                      </h4>
                    </div>

                    {/* Description Box (Bottom) */}
                    <div 
                      className={`absolute top-12 w-56 md:w-64 transition-all duration-700 ease-out flex justify-center ${
                        isActive 
                          ? 'opacity-100 translate-y-0 pointer-events-auto' 
                          : 'opacity-30 md:opacity-0 pointer-events-none -translate-y-8'
                      }`}
                    >
                      <ul className="space-y-3 border-l-2 border-white/10 pl-4 text-left w-full max-w-[200px]">
                        {phase.milestones.map((m, i) => (
                          <li key={i} className="relative">
                            <span 
                              className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full transition-all duration-500 ${isActive ? 'bg-[#d946ef]' : 'bg-white/10'}`} 
                              style={{ transitionDelay: `${i * 100}ms` }} 
                            />
                            <span className={`text-[11px] md:text-xs font-mono tracking-tight transition-colors duration-500 ${isActive ? 'text-gray-200' : 'text-gray-600'}`}>
                              {m}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator for mobile */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 md:hidden text-gray-600 text-[10px] uppercase tracking-widest font-bold items-center pointer-events-none">
        <span>&larr;</span> Desliza <span>&rarr;</span>
      </div>

    </section>
  );
}
