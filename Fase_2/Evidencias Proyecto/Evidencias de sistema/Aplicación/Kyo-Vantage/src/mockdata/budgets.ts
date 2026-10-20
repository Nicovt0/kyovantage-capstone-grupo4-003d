export interface Budget {
  id: string;
  user_id?: string;
  category_id: string; // La categoría a la que aplica este presupuesto
  limit_amount: number; // El límite máximo establecido
  period: 'weekly' | 'monthly' | 'annual';
  recurrent: boolean;
  rollover: boolean;
  alert_threshold: number; // Porcentaje de alerta (ej: 80)
  start_date?: string;
}

export const budgetsDb: Budget[] = [
  {
    id: 'b1',
    category_id: 'exp-2', // Supermercado y Feria
    limit_amount: 200000,
    period: 'monthly',
    recurrent: true,
    rollover: false,
    alert_threshold: 80,
    start_date: '2026-05-01T00:00:00.000Z'
  },
  {
    id: 'b2',
    category_id: 'exp-10', // Salir a Comer / Delivery
    limit_amount: 50000,
    period: 'monthly',
    recurrent: true,
    rollover: true,
    alert_threshold: 90,
    start_date: '2026-05-01T00:00:00.000Z'
  }
];


export const getBudgets = () => budgetsDb;
export const addBudget = (budget: Budget) => {
  budgetsDb.push(budget);
  return budget;
};
