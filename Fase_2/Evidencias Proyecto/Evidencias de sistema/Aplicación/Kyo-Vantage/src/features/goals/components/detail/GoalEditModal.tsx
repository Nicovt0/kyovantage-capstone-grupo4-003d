import type { Goal } from '@/types';
import { AppModal } from '@/shared/ui/AppModal';
import { GoalEditor } from '../form/GoalEditor';
export function GoalEditModal({goal,isOpen,onClose}:{goal:Goal;isOpen:boolean;onClose:()=>void}) {
  return <AppModal isOpen={isOpen} onClose={onClose} title="Editar Meta de Ahorro">
    {isOpen && <GoalEditor key={goal.id} goal={goal} onSaved={onClose} onCancel={onClose}/>}
  </AppModal>;
}
