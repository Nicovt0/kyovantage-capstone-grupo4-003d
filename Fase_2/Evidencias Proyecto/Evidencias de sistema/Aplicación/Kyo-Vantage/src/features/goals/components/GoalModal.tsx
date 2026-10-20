import { Flag } from 'lucide-react';
import { AppModal } from '@/shared/ui/AppModal';
import { GoalEditor } from './form/GoalEditor';
export function GoalModal({isOpen,onClose,onSaved}:{isOpen:boolean;onClose:()=>void;onSaved:()=>void}) {
  return <AppModal isOpen={isOpen} onClose={onClose} title="Crear Meta de Ahorro" icon={<Flag size={22} className="text-kyo-lightPurple" />}>
    {isOpen && <GoalEditor onSaved={()=>{onSaved();onClose();}} onCancel={onClose}/>}
  </AppModal>;
}
