import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { joinWaitlist } from '@/features/admin/api/invitations';
import { Instagram } from 'lucide-react';

export function Footer() {
  const [emailLead, setEmailLead] = useState('');
  const [leadStatus, setLeadStatus] = useState<'success' | 'error' | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadError, setLeadError] = useState('');

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setLeadStatus(null);
    setLeadError('');
    if (!emailLead.trim() || !emailLead.includes('@')) {
      setLeadStatus('error');
      setLeadError('Ingresa un correo válido.');
      setTimeout(() => setLeadStatus(null), 2000);
      return;
    }

    setIsSubmitting(true);
    try {
      await joinWaitlist(emailLead);

      setLeadStatus('success');
      setEmailLead('');
      setTimeout(() => setLeadStatus(null), 5000);
    } catch (err) {
      setLeadStatus('error');
      setLeadError(err instanceof Error ? err.message : 'No se pudo guardar la solicitud. Inténtalo nuevamente.');
    } finally { setIsSubmitting(false); }
  };

  return (
    <footer className="relative z-10 w-full border-t border-border-subtle bg-surface-navbar pt-16 pb-8 mt-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-12">

        {/* Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 mb-12 text-center md:text-left items-center md:items-start">

          {/* Logo y Redes Sociales */}
          <div className="flex flex-col items-center justify-center gap-6 h-full">
            <img src="/VANTAGE.png" alt="Vantage Icon" width={128} height={128} className="w-[48px] md:w-[64px] h-auto" />

            <div className="flex flex-col items-center">
              <span className="text-sm font-semibold text-gray-900 dark:text-white mb-4 tracking-wide">Síguenos</span>
              <div className="flex items-center gap-4">
                <a href="https://instagram.com/kyovantage" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center text-white hover:bg-[#9b70f7] hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_14px_0_rgba(124,58,237,0.25)]" aria-label="Instagram">
                  <Instagram size={20} />
                </a>
                <a href="https://tiktok.com/@kyovantage" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center text-white hover:bg-[#9b70f7] hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_14px_0_rgba(124,58,237,0.25)]" aria-label="TikTok">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Producto */}
          <div className="flex flex-col items-center md:items-start">
            <span className="text-sm font-semibold text-gray-900 dark:text-white mb-4 tracking-wide">Producto</span>
            <div className="flex flex-col gap-3">
              <a href="/#features" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Billetera Inteligente</a>
              <a href="/#features" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Gestión de Presupuestos</a>
              <a href="/#features" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Metas de Ahorro</a>
              <a href="/#features" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Agenda Financiera</a>
            </div>
          </div>

          {/* Ayuda */}
          <div className="flex flex-col items-center md:items-start">
            <span className="text-sm font-semibold text-gray-900 dark:text-white mb-4 tracking-wide">Ayuda</span>
            <div className="flex flex-col gap-3">
              <a href="#" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Quiénes somos</a>
              <Link to="/privacy" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Políticas de privacidad</Link>
              <Link to="/terms" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Términos y condiciones</Link>
              <a href="/#faq" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Preguntas frecuentes</a>
              <a href="#" className="text-[13px] text-gray-500 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-all hover:translate-x-1">Formulario de contacto</a>
            </div>
          </div>

          {/* Suscríbete & Contacto */}
          <div className="flex flex-col items-center md:items-start">
            <span className="text-sm font-semibold text-gray-900 dark:text-white mb-4 tracking-wide">Únete a la Beta</span>
            <form onSubmit={handleSaveLead} className="w-full max-w-[280px] relative mb-4">
              <input
                type="email"
                placeholder="Tu correo electrónico"
                value={emailLead}
                onChange={(e) => setEmailLead(e.target.value)}
                className="w-full bg-gray-100 dark:bg-[#15142b] border border-transparent focus:border-[#7c3aed]/50 text-[13px] rounded-xl py-3 pl-4 pr-12 outline-none text-gray-900 dark:text-white transition-all placeholder:text-gray-400 dark:placeholder:text-[#5a5a72]"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="absolute right-1 top-1 bottom-1 aspect-square rounded-lg bg-[#7c3aed] hover:bg-[#9b70f7] text-white flex items-center justify-center transition-colors shadow-sm"
                aria-label={isSubmitting ? 'Enviando solicitud' : 'Enviar'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            </form>
            {leadStatus === 'success' && <p role="status" className="text-[11px] text-[#17c964] mb-4">¡Listo! Tu correo está en la lista de espera.</p>}
            {leadStatus === 'error' && <p role="alert" className="text-[11px] text-danger mb-4">{leadError}</p>}

            <div className="mt-2">
              <span className="text-[11px] text-gray-400 dark:text-[#5a5a72] block mb-1">¿Necesitas ayuda directa?</span>
              <a href="mailto:Soporte@kyovantage.cl" className="text-[13px] font-medium text-gray-600 hover:text-[#7c3aed] dark:text-[#a0a0b8] dark:hover:text-[#c4b5fd] transition-colors">
                Soporte@kyovantage.cl
              </a>
            </div>
          </div>

        </div>

        {/* Copyright */}
        <div className="w-full text-center border-t border-gray-200 dark:border-white/5 pt-8">
          <p className="text-[13px] text-gray-500 dark:text-[#a0a0b8] font-light">
            &copy; {new Date().getFullYear()} Kyo Vantage. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
