import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

interface ViewHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  titleSuffix?: ReactNode;
  onBack?: () => void;
}

export function ViewHeader({ icon, title, description, actions, titleSuffix, onBack }: ViewHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-card border border-[#6d28d9]/30 rounded-3xl p-6 shadow-card-soft relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-brand-primary/5 dark:bg-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-4 relative z-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="w-8 h-8 rounded-full bg-surface-raised hover:bg-surface-raised flex items-center justify-center text-on-surface-card-body hover:text-foreground transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6d28d9] to-[#8b5cf6] flex items-center justify-center text-white shadow-lg shadow-[#6d28d9]/30 shrink-0">
          {icon}
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
            <span>{title}</span>
            {titleSuffix}
          </h1>
          {description && <p className="text-on-surface-card-secondary text-xs mt-0.5">{description}</p>}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-3 relative z-10 self-start md:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
