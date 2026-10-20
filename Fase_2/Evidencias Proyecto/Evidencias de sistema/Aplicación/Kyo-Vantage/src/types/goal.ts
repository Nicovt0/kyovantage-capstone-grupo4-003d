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
  savings_account_id?: string | null;
  color: string;
  icon_name: string;
}
