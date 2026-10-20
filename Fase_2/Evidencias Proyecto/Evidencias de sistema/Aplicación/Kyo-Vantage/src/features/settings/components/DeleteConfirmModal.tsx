import { useState } from "react";
import { Button } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, title, description }: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-danger/30 rounded-3xl shadow-2xl w-full max-w-[400px] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden relative">

        <div className="p-6 flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-2">
            <AlertTriangle size={32} />
          </div>

          <h2 className="text-xl font-black text-foreground">{title}</h2>

          <div className="text-[#5a5a72] dark:text-[#a0a0b8] text-sm leading-relaxed">
            {description}
          </div>
        </div>

        <div className="p-5 bg-default-50 dark:bg-surface-card/50 border-t border-default-100 dark:border-danger/10 flex flex-col sm:flex-row justify-center gap-3 shrink-0 relative z-10">
          <Button
            variant="ghost"
            onPress={onClose}
            className="font-bold border-transparent w-full sm:w-auto rounded-2xl"
            isDisabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            className="bg-danger text-white font-bold w-full sm:w-auto shadow-md rounded-2xl"
            isDisabled={isDeleting}
            onPress={handleConfirm}
          >
            {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
          </Button>
        </div>

      </div>
    </div>
  );
}
