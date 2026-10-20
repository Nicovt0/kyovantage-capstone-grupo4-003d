export interface Goal {
  id: string;
  user_id?: string;
  name: string;
  target_amount: number; // Cuánto quieres lograr
  current_amount: number; // Cuánto tienes hoy
  deadline_date: string; 
  start_date: string;
  plan_start_date?: string | null;
  contribution_amount: number;
  contribution_type: 'auto' | 'fixed' | 'free';
  priority: 'high' | 'mid' | 'low';
  reminders: boolean;
  color: string;
  icon_name: string;
}

export const goalsDb: Goal[] = [
  {
    id: 'g1',
    name: 'Fondo de Emergencia',
    target_amount: 3000000,
    current_amount: 1200000,
    start_date: '2025-01-01T00:00:00.000Z',
    deadline_date: '2026-12-01T00:00:00.000Z',
    contribution_amount: 50000,
    contribution_type: 'fixed',
    priority: 'high',
    reminders: true,
    color: '#0F6E56',
    icon_name: 'ShieldCheck'
  },
  {
    id: 'g2',
    name: 'Viaje a Japón',
    target_amount: 5000000,
    current_amount: 500000,
    start_date: '2025-05-01T00:00:00.000Z',
    deadline_date: '2026-12-01T00:00:00.000Z',
    contribution_amount: 30000,
    contribution_type: 'auto',
    priority: 'mid',
    reminders: false,
    color: '#854F0B',
    icon_name: 'Plane'
  }
];


export const getGoals = () => goalsDb;
export const addGoal = (goal: Goal) => {
  goalsDb.push(goal);
  return goal;
};
