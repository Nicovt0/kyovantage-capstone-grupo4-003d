import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAppUrl } from '@/lib/siteUrls';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const appUrl = getAppUrl();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between transition-all duration-300 bg-surface-navbar border-b border-border-subtle ${isScrolled ? 'py-3 px-6 md:px-12' : 'py-4 md:py-[18px] px-6 md:px-12'}`}>
      <Link to="/" className="flex items-center gap-3 no-underline">
        <img src="/VANTAGE.png" alt="Vantage Icon" width={100} height={100} className="w-[32px] md:w-[40px] h-auto" fetchPriority="high" />
      </Link>
      <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        <a href="/#features" className="text-[14px] font-medium text-gray-600 dark:text-[#a0a0b8] hover:text-[#7c3aed] dark:hover:text-white transition-colors">Funcionalidades</a>
        <a href="/#roadmap" className="text-[14px] font-medium text-gray-600 dark:text-[#a0a0b8] hover:text-[#7c3aed] dark:hover:text-white transition-colors">Roadmap</a>
        <a href="/#commitment" className="text-[14px] font-medium text-gray-600 dark:text-[#a0a0b8] hover:text-[#7c3aed] dark:hover:text-white transition-colors">Privacidad</a>
        <a href="/#faq" className="text-[14px] font-medium text-gray-600 dark:text-[#a0a0b8] hover:text-[#7c3aed] dark:hover:text-white transition-colors">Preguntas</a>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <a href={`${appUrl}/login`} className="text-[13px] font-bold text-gray-700 dark:text-white hover:text-[#7c3aed] dark:hover:text-[#c4b5fd] transition-colors px-2 md:px-3 py-2">Iniciar Sesión</a>
        <a href={`${appUrl}/register`} className="bg-[#7c3aed] hover:bg-[#9b70f7] text-white rounded-xl py-2 px-3 md:py-2.5 md:px-5 text-[13px] font-bold transition-all shadow-[0_4px_14px_rgba(124,58,237,0.39)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.23)] hover:-translate-y-[1px]">Registrarse</a>
      </div>
    </nav>
  );
}
