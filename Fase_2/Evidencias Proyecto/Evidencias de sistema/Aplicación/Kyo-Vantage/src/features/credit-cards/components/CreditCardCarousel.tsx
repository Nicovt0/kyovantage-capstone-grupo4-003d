import { useState, useRef, useEffect } from "react";
import { CreditCard, Bank, BillingStatement } from "@/types";
import { CreditCardVisual } from "@/shared/ui/CreditCardVisual";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Tooltip } from "@heroui/react";
import { useNavigate } from 'react-router-dom';

interface CreditCardCarouselProps {
  creditCards: CreditCard[];
  banks: Bank[];
  billingStatements?: BillingStatement[];
  onCardClick?: (cardId: string) => void;
  onAddCardClick?: () => void;
  variant?: 'dashboard' | 'overview';
}

export function CreditCardCarousel({ creditCards, banks, billingStatements = [], onCardClick, onAddCardClick, variant = 'overview' }: CreditCardCarouselProps) {

  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    // Ancho de la tarjeta aprox 280px + gap 16px = 296px
    const index = Math.round(scrollLeft / 296);
    if (index !== activeIndex && index >= 0 && index < creditCards.length) {
      setActiveIndex(index);
    }
  };

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= creditCards.length) return;
    scrollRef.current?.scrollTo({ left: index * 296, behavior: 'smooth' });
    setActiveIndex(index);
  };

  // Si no hay tarjetas y es dashboard (no tiene add-slot propio), retorna null
  // Para overview siempre renderizamos (mostrará solo la tarjeta de añadir)

  return (
    <div className="relative w-full">
      {/* Botones de navegación (ocultos en móvil, visibles en desktop al hacer hover en el contenedor o siempre visibles discretos) */}
      {creditCards.length > 1 && (
        <>
          <button
            className="absolute left-0 md:-left-4 top-[85px] z-20 bg-white/50 dark:bg-black/50 backdrop-blur-md border border-black/10 dark:border-white/10 text-foreground rounded-full p-2 shadow-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all opacity-0 md:opacity-100 hover:scale-110 disabled:opacity-0 disabled:cursor-not-allowed"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            className="absolute right-0 md:-right-4 top-[85px] z-20 bg-white/50 dark:bg-black/50 backdrop-blur-md border border-black/10 dark:border-white/10 text-foreground rounded-full p-2 shadow-lg hover:bg-white/80 dark:hover:bg-white/20 transition-all opacity-0 md:opacity-100 hover:scale-110 disabled:opacity-0 disabled:cursor-not-allowed"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === creditCards.length - 1}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Carrusel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full"
      >
        {/* Espaciador Izquierdo para centrar el primer elemento */}
        <div className="shrink-0 w-[calc(50vw-140px)] md:w-[calc(50%-140px)]" />

        {creditCards.map((card, idx) => {
          const isActive = idx === activeIndex;
          const debt = card.current_debt || 0;
          const limit = card.total_limit || 0;
          const available = Math.max(0, limit - debt);

          // Buscar statement pendiente para esta tarjeta
          const statement = billingStatements.find(s => s.credit_card_id === card.id && (s.status === 'pending' || s.status === 'partial'));
          const toPay = statement ? Math.max(0, statement.total_due - statement.amount_paid) : 0;

          return (
            <div
              key={card.id}
              className={`snap-center shrink-0 transition-all duration-500 cursor-pointer flex flex-col items-center
                ${isActive ? 'scale-100 opacity-100 drop-shadow-md dark:drop-shadow-2xl' : 'scale-[0.85] opacity-40 hover:opacity-60'}`}
              onClick={() => {
                if (!isActive) {
                  scrollToIndex(idx);
                } else if (onCardClick) {
                  onCardClick(card.id);
                }
              }}
            >
              <div className="w-[280px]">
                <CreditCardVisual
                  card={card}
                  bank={banks.find(b => b.id === card.bank_id)}
                />
              </div>

              {/* Detalles rápidos debajo de la tarjeta activa según variante */}
              {variant === 'dashboard' ? (
                <div className={`mt-6 w-[280px] bg-[#fdfbf7] dark:bg-surface-card border border-black/5 dark:border-border-subtle rounded-2xl shadow-[0_4px_14px_0_rgb(0,0,0,0.05)] dark:shadow-none p-4 transition-all duration-500 flex flex-col items-center justify-center ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute bottom-0'}`}>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-default-500 mb-1">Pago del mes</span>
                  {toPay > 0 ? (
                    <span className="text-lg font-semibold text-[#f31260]">${toPay.toLocaleString('es-CL')}</span>
                  ) : (
                    <span className="text-sm font-medium text-[#17c964]">Al día ✨</span>
                  )}
                </div>
              ) : (
                <div className={`mt-6 w-[320px] bg-[#fdfbf7] dark:bg-surface-card border border-black/5 dark:border-border-subtle rounded-2xl shadow-[0_4px_14px_0_rgb(0,0,0,0.05)] dark:shadow-none p-4 transition-all duration-500 flex justify-between items-center ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute bottom-0'}`}>

                  <div className="flex flex-col flex-1 items-center justify-center text-center">
                    <span className="text-[10px] font-normal uppercase tracking-widest text-[#f31260]">Deuda</span>
                    <span className="text-sm font-medium text-foreground mt-0.5">${debt.toLocaleString('es-CL')}</span>
                  </div>

                  <div className="w-px h-8 bg-default-100 dark:bg-surface-raised mx-2" />

                  <div className="flex flex-col flex-1 items-center justify-center text-center">
                    <span className="text-[10px] font-normal uppercase tracking-widest text-[#17c964]">Disponible</span>
                    <span className="text-sm font-medium text-foreground mt-0.5">${available.toLocaleString('es-CL')}</span>
                  </div>

                  <div className="w-px h-8 bg-default-100 dark:bg-surface-raised mx-2" />

                  <div className="flex flex-col flex-1 items-center justify-center text-center">
                    <span className="text-[10px] font-normal uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8]">Total</span>
                    <span className="text-sm font-medium text-foreground mt-0.5">${limit.toLocaleString('es-CL')}</span>
                  </div>

                </div>
              )}
            </div>
          );
        })}
        {/* Tarjeta de añadir (si no se llegó al límite) */}
        {creditCards.length < 5 && (
          <div
            className="snap-center shrink-0 flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => {
              if (onAddCardClick) {
                onAddCardClick();
              } else {
                navigate('/credit-cards/add');
              }
            }}
          >
            <div className={`${
              variant === 'dashboard' ? 'w-[280px] h-[160px]' : 'w-[280px] h-[160px]'
            } rounded-[20px] flex flex-col items-center justify-center gap-2 bg-default-50 dark:bg-surface-raised border-2 border-dashed border-default-200 dark:border-border-subtle hover:border-[#6d28d9] dark:hover:border-[#6d28d9] transition-colors group`}>
              <div className="w-10 h-10 rounded-full bg-default-100 dark:bg-white/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
                <Plus size={20} className="text-[#5a5a72] dark:text-[#a0a0b8] group-hover:text-[#6d28d9]" />
              </div>
              <span className="text-xs font-medium text-[#5a5a72] dark:text-[#a0a0b8] uppercase tracking-wide group-hover:text-[#6d28d9]">Añadir tarjeta</span>
            </div>
          </div>
        )}

        {/* Espaciador Derecho para centrar el último elemento */}
        <div className="shrink-0 w-[calc(50vw-140px)] md:w-[calc(50%-140px)]" />
      </div>
    </div>
  );
}
