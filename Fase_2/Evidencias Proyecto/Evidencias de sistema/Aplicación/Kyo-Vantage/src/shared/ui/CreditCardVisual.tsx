import React from 'react';
import { CreditCard, Bank } from '@/types';

interface CreditCardVisualProps {
  card: CreditCard | Partial<CreditCard>;
  bank?: Bank;
  bankName?: string; // Override for bank name display (useful in forms)
  onClick?: () => void;
  className?: string;
  topRightSlot?: React.ReactNode; // For action buttons (edit/delete in detail view)
  size?: 'sm' | 'md' | 'lg';
}

function IssuerLogo({ issuer, isLight }: { issuer?: string, isLight?: boolean }) {
  const i = issuer?.toLowerCase() || '';
  const textOpacity = isLight ? 'opacity-80' : 'opacity-90';

  if (i === 'visa') return <span className={`text-[14px] font-black italic tracking-tight ${textOpacity}`}>VISA</span>;
  if (i === 'mastercard') return (
    <div className="flex items-center -space-x-1.5">
      <div className="w-4 h-4 rounded-full bg-[#EB001B] opacity-90" />
      <div className="w-4 h-4 rounded-full bg-[#F79E1B] opacity-90" />
    </div>
  );
  if (i === 'amex') return (
    <div className={`flex flex-col items-end justify-center ${textOpacity}`}>
      <span className="font-black text-[7px] leading-[7px] tracking-tight">AMERICAN</span>
      <span className="font-black text-[7px] leading-[7px] tracking-tight">EXPRESS</span>
    </div>
  );
  return <span className={`text-[10px] font-bold uppercase tracking-wider ${textOpacity}`}>{issuer || 'VISA'}</span>;
}

function getLuminance(colorString: string) {
  if (!colorString) return 0;
  const color = colorString.trim().toLowerCase();

  // HSL
  if (color.startsWith('hsl')) {
    const match = color.match(/\d+(\.\d+)?/g);
    if (match && match.length >= 3) {
      return parseFloat(match[2]) / 100;
    }
    return 0;
  }

  let r = 0, g = 0, b = 0;
  // RGB
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    }
  } else {
    // HEX
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 8) hex = hex.substring(0, 6);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 2), 16);
      b = parseInt(hex.substring(4, 2), 16);
    }
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function CreditCardVisual({ card, bank, bankName, onClick, className = '', topRightSlot, size = 'md' }: CreditCardVisualProps) {
  const typeStr = card.type?.toLowerCase() || '';
  const isClassic = typeStr === 'classic' || !['gold', 'platinum', 'black'].includes(typeStr);

  let cardGradient = "from-[#7B5E0E] via-[#B8860B] to-[#C8930A]";
  if (typeStr === 'platinum') cardGradient = "from-[#2C2C2C] via-[#5A5A5A] to-[#4A4A4A]";
  else if (typeStr === 'black') cardGradient = "from-[#0A0A0A] via-[#1A1A1A] to-[#111111]";

  const bgColor = bank?.color || '#534AB7';
  const customStyle = isClassic ? { backgroundColor: bgColor } : {};
  const isLight = isClassic && getLuminance(bgColor) > 0.5;
  const resolvedBankName = bankName || bank?.name;

  // Dynamic classes based on contrast
  const textClass = isLight ? 'text-black/80 drop-shadow-none' : 'text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]';
  const textMutedClass = isLight ? 'text-black/60' : 'text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]';
  const badgeClass = isLight
    ? 'bg-black/10 text-black/80 border-black/10'
    : 'bg-black/30 text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] border-white/10';

  return (
    <div
      className={`shrink-0 w-[280px] h-[160px] rounded-[20px] p-[18px_20px] flex flex-col justify-between relative overflow-hidden cursor-pointer snap-center transition-transform active:scale-95 ${!isClassic ? 'bg-gradient-to-br ' + cardGradient : ''} mx-auto ${className} ${isLight ? 'text-black/80' : 'text-white/95'}`}
      style={customStyle}
      onClick={onClick}
    >
      {/* Inner gradient to give flat colors more depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none" />

      {/* Overlay diagonal effect */}
      <div
        className="absolute top-[-35%] left-[-15%] w-[55%] h-[160%] bg-white/[0.12] pointer-events-none"
        style={{ transform: 'rotate(25deg)' }}
      />

      <div className="flex justify-between items-start z-10 w-full">
        <div className="flex flex-col flex-1 mr-2">
          <span className={`text-[15px] font-bold tracking-tight truncate ${textClass}`}>
            {card.name || 'Tu tarjeta'}
          </span>
          {resolvedBankName && (
            <span className={`text-[11px] font-medium uppercase tracking-widest truncate mt-1 ${textMutedClass}`}>
              {resolvedBankName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <IssuerLogo issuer={card.issuer} isLight={isLight} />
          {topRightSlot}
        </div>
      </div>

      <div className="flex items-center z-10 mt-2 mb-auto">
        <div className="w-[32px] h-[22px] rounded-[4px] bg-gradient-to-br from-[#E2C474] to-[#B89234] shadow-sm relative overflow-hidden">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-black/10" />
        </div>
      </div>

      <div className="flex justify-between items-end z-10 w-full">
        <span className={`text-[14px] font-mono tracking-widest font-medium ${textClass}`}>
          {card.last_4_digits || '____'}
        </span>
        <div className={`text-[9px] p-[3px_9px] rounded-full font-semibold tracking-[0.05em] shrink-0 border ${badgeClass}`}>
          {card.type || 'Classic'}
        </div>
      </div>
    </div>
  );
}
