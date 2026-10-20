import { useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { CreditCard } from "@/types";
import { deleteCreditCard } from "@/features/credit-cards/api/creditCardRepository";
import { useNavigate } from 'react-router-dom';
import { X, Trash2, AlertTriangle } from "lucide-react";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";

interface CreditCardDeleteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard;
}

export function CreditCardDeleteModal({ isOpen, onOpenChange, card }: CreditCardDeleteModalProps) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg('');
    try {
      await runMutation(() => deleteCreditCard(card.id));
      onOpenChange(false);
      navigate('/credit-cards');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Ocurrió un error al eliminar la tarjeta.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
    }}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-[#f31260]/30 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-4 border-b border-default-100 dark:border-[#f31260]/20">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trash2 size={18} className="text-[#f31260]" />
            Archivar Tarjeta
          </h2>
          <button onClick={() => onOpenChange(false)} className="text-default-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-2">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-bold text-foreground">¿Estás absolutamente seguro?</h3>
          <p className="text-sm text-default-500">
            La tarjeta <strong>{card.name}</strong> dejará de aparecer entre tus productos activos. Sus compras, movimientos y estados de cuenta se conservarán en el historial.
          </p>

          {errorMsg && (
            <div className="p-3 bg-danger/10 text-danger border border-danger/20 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-default-100 dark:border-[#f31260]/20 flex justify-end gap-2 bg-default-50 dark:bg-transparent rounded-b-2xl">
          <Button variant="ghost" onPress={() => onOpenChange(false)} className="rounded-2xl">
            Cancelar
          </Button>
          <Button
            onPress={handleDelete}
            isDisabled={isDeleting}
            className="bg-[#f31260] text-white font-bold rounded-2xl"
          >
            {isDeleting ? <Spinner size="sm" color="current" /> : 'Archivar Tarjeta'}
          </Button>
        </div>

      </div>
    </div>
  );
}
