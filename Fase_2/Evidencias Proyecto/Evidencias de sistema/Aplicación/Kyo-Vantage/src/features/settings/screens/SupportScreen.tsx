import { PageHeader } from "@/shared/ui/PageHeader";
import { LifeBuoy, Send, MessageSquarePlus, Bug, Lightbulb, HeartHandshake } from "lucide-react";
import { useState } from "react";
import { createNotification } from "@/features/notifications/api/notificationRepository";
import { usePrivateMutation } from '@/features/app-shell/hooks/usePrivateMutation';

export default function SupportPage() {
  const { runMutation } = usePrivateMutation();
  const [type, setType] = useState("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      alert("Por favor completa el asunto y el mensaje.");
      return;
    }

    setIsSubmitting(true);
    // Simular envío a API
    await new Promise(res => setTimeout(res, 1200));

    await runMutation(() => createNotification({
      type: 'system',
      title: 'Ticket de Soporte Enviado',
      message: `Hemos recibido tu ${type === 'bug' ? 'reporte de error' : 'sugerencia'}. Te contactaremos pronto.`
    }));

    setSubject("");
    setMessage("");
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in pb-20">
      <div className="flex flex-col w-full">
        <PageHeader title="Soporte y Ayuda" showBack />
      </div>



      <div className="flex flex-col gap-6">

        {/* Banner */}
        <div className="bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] rounded-3xl p-6 text-white shadow-lg shadow-[#6d28d9]/20 relative overflow-hidden flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
            <LifeBuoy size={32} />
          </div>
          <h2 className="text-xl font-bold">¿Cómo podemos ayudarte?</h2>
          <p className="text-white/80 text-sm max-w-[280px]">
            Tu opinión es vital para mejorar Kyo Vantage. Repórtanos errores o sugiérenos nuevas funciones.
          </p>
        </div>

        {/* Formulario */}
        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto mt-2">

           <div className="flex flex-col gap-2">
             <label className="text-[12px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wider ml-1">Tipo de Solicitud</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setType('suggestion')}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${type === 'suggestion' ? 'border-[#6d28d9] bg-brand-primary/10 text-[#6d28d9] shadow-sm' : 'border-transparent dark:border-border-subtle bg-white dark:bg-surface-card text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card'}`}
                >
                  <Lightbulb size={24} />
                  <span className="text-[11px] font-bold uppercase tracking-wider mt-1">Sugerencia</span>
                </button>
                <button
                  onClick={() => setType('bug')}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${type === 'bug' ? 'border-[#f31260] bg-[#f31260]/10 text-[#f31260] shadow-sm' : 'border-transparent dark:border-border-subtle bg-white dark:bg-surface-card text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card'}`}
                >
                  <Bug size={24} />
                  <span className="text-[11px] font-bold uppercase tracking-wider mt-1">Error</span>
                </button>
                <button
                  onClick={() => setType('other')}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${type === 'other' ? 'border-[#17c964] bg-[#17c964]/10 text-[#17c964] shadow-sm' : 'border-transparent dark:border-border-subtle bg-white dark:bg-surface-card text-[#5a5a72] hover:bg-default-100 dark:hover:bg-surface-card'}`}
                >
                  <MessageSquarePlus size={24} />
                  <span className="text-[11px] font-bold uppercase tracking-wider mt-1">Otro</span>
                </button>
              </div>
           </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Asunto</label>
                <span className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8]">{subject.length}/50</span>
              </div>
              <div className="flex items-center gap-3 bg-white dark:bg-surface-card p-4 rounded-xl border border-transparent dark:border-border-subtle focus-within:border-[#6d28d9] transition-all shadow-sm">
                 <input
                   placeholder="Resumen de tu solicitud"
                   value={subject}
                   maxLength={50}
                   onChange={(e) => setSubject(e.target.value)}
                   className="bg-transparent border-none outline-none w-full font-bold text-foreground text-sm"
                 />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-widest ml-1">Mensaje Detallado</label>
                <span className="text-[10px] font-bold text-[#5a5a72] dark:text-[#a0a0b8]">{message.length}/500</span>
              </div>
              <div className="bg-white dark:bg-surface-card p-4 rounded-xl border border-transparent dark:border-border-subtle focus-within:border-[#6d28d9] transition-all min-h-[150px] shadow-sm flex">
                 <textarea
                   placeholder="Cuéntanos más detalles..."
                   value={message}
                   maxLength={500}
                   onChange={(e) => setMessage(e.target.value)}
                   rows={5}
                   className="bg-transparent border-none outline-none w-full font-bold text-foreground text-sm resize-none"
                 />
              </div>
            </div>

            <button
              className="w-full h-14 bg-brand-primary hover:bg-[#5b21b6] text-white font-bold rounded-xl shadow-md transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleSubmit}
              disabled={isSubmitting || !subject.trim() || !message.trim()}
            >
              {isSubmitting && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
            </button>

        </div>

        <div className="flex items-center justify-center gap-2 opacity-50 mt-4">
          <HeartHandshake size={16} />
          <span className="text-xs font-bold text-foreground uppercase tracking-widest">Hecho con cariño para ti</span>
        </div>

      </div>
    </div>
  );
}
