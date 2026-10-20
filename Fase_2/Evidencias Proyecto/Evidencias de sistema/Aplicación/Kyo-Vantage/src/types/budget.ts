export interface Budget {
  id: string;
  user_id?: string;
  category_id: string; // La categoría a la que aplica este presupuesto
  limit_amount: number; // El límite máximo establecido
  period: 'weekly' | 'monthly' | 'annual';
  recurrent: boolean;
  rollover: boolean;
  alert_threshold: number; // Porcentaje de alerta (ej: 80)
  start_date?: string; // ISO date string when the budget was created/started
}
