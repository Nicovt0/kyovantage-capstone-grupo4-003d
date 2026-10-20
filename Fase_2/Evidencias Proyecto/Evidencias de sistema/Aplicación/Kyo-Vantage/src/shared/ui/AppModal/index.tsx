import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidthClass?: string;
}

export function AppModal({ isOpen, onClose, title, description, icon, children, maxWidthClass = 'max-w-lg' }: AppModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`relative w-full ${maxWidthClass} rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-5">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              {description && <p className="text-xs text-on-surface-card-secondary mt-0.5">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-on-surface-card-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
