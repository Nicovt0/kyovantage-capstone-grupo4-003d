import { useState } from "react";
import { Budget } from "@/types";
import { Button } from "@heroui/react";
import { deleteBudget } from "@/features/budget/api/budgetRepository";
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle } from "lucide-react";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";

interface BudgetDeleteModalProps {
  budget: Budget;
  isOpen: boolean;
  onClose: () => void;
}

export function BudgetDeleteModal({ budget, isOpen, onClose }: BudgetDeleteModalProps) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await runMutation(() => deleteBudget(budget.id));
      navigate('/planning');
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-border-subtle rounded-3xl shadow-2xl w-full max-w-[400px] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">

        <div className="p-5 border-b border-default-100 dark:border-border-subtle flex justify-between items-center bg-danger/5">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold">Eliminar Presupuesto</h2>
          </div>
          <button onClick={onClose} className="p-2 text-default-400 hover:bg-default-100 dark:hover:bg-surface-card rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-foreground leading-relaxed">
            ¿Estás seguro que deseas eliminar este presupuesto? Se borrará su configuración mensual y todo su historial de límites, pero <strong>no</strong> eliminará las transacciones asociadas a la categoría.
          </p>
        </div>

        <div className="p-5 border-t border-default-100 dark:border-border-subtle flex justify-end gap-3 bg-default-50/50 dark:bg-surface-card/50">
          <Button variant="ghost" onPress={onClose} className="font-semibold border-transparent rounded-2xl">Cancelar</Button>
          <Button
            variant="ghost"
            className="bg-danger text-white font-bold border-transparent hover:bg-danger/90 rounded-2xl"
            isDisabled={isDeleting}
            onPress={handleDelete}
          >
            {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </div>

      </div>
    </div>
  );
}
