import { useNavigate } from 'react-router-dom';
import { GoalEditor } from './GoalEditor';
export function GoalForm() {
  const navigate=useNavigate();
  return <div className="pb-24"><GoalEditor onSaved={()=>navigate('/goals')} onCancel={()=>navigate('/goals')}/></div>;
}
