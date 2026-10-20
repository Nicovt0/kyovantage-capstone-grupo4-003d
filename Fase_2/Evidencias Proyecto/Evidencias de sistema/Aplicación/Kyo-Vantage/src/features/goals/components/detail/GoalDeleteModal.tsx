import { useState } from "react";
import { Goal } from "@/types";
import { usePrivateMutation } from "@/features/app-shell/hooks/usePrivateMutation";
import { Button } from "@heroui/react";
import { deleteGoal } from "@/features/goals/api/goalRepository";
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from "lucide-react";

interface GoalDeleteModalProps {
  goal: Goal;
  isOpen: boolean;
  onClose: () => void;
}

export function GoalDeleteModal({ goal, isOpen, onClose }: GoalDeleteModalProps) {
  const navigate = useNavigate();
  const { runMutation } = usePrivateMutation();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await runMutation(() => deleteGoal(goal.id));
      navigate('/planning');
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-surface-card border border-transparent dark:border-danger/30 rounded-3xl shadow-2xl w-full max-w-[400px] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden relative">

        {/* Glow rojo sutil */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-danger/20 blur-[60px] rounded-full pointer-events-none" />

        <div className="p-6 flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-2">
            <AlertTriangle size={32} />
          </div>

          <h2 className="text-xl font-black text-foreground">¿Eliminar Meta?</h2>

          <p className="text-[#5a5a72] dark:text-[#a0a0b8] text-sm leading-relaxed">
            Estás a punto de eliminar la meta <strong className="text-foreground">{goal.name}</strong>.
            Sus aportes registrados pasarán a ser gastos generales, y los cobros futuros pendientes se cancelarán.
          </p>
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
            onPress={handleDelete}
          >
            {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
          </Button>
        </div>

      </div>
    </div>
  );
}
