import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastNotificationProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function ToastNotification({ toast, onDismiss }: ToastNotificationProps) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md text-xs font-semibold ${
          isSuccess
            ? 'border-emerald-500/40 bg-[#0d281e]/90 text-emerald-200 shadow-emerald-500/10'
            : isError
            ? 'border-red-500/40 bg-[#2b0d14]/90 text-red-200 shadow-red-500/10'
            : 'border-[#6d28d9]/40 bg-[#16102e]/90 text-purple-200 shadow-[#6d28d9]/10'
        }`}
      >
        {isSuccess && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
        {isError && <AlertTriangle size={16} className="text-red-400 shrink-0" />}
        {!isSuccess && !isError && <Info size={16} className="text-[#a78bfa] shrink-0" />}

        <span>{toast.message}</span>

        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 rounded-lg p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
