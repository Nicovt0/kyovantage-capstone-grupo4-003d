export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon_name: string;
}

export const categoriesDb: Category[] = [
  // ==========================================
  // INGRESOS
  // ==========================================
  // Principales (Fijos)
  { id: 'inc-1', name: 'Sueldo', type: 'income', icon_name: 'Briefcase' },
  { id: 'inc-2', name: 'Pensiones / Becas', type: 'income', icon_name: 'GraduationCap' },

  // Variables (Flexibles)
  { id: 'inc-3', name: 'Freelance / Honorarios', type: 'income', icon_name: 'Laptop' },
  { id: 'inc-4', name: 'Ventas', type: 'income', icon_name: 'Store' },
  { id: 'inc-5', name: 'Bonos / Comisiones', type: 'income', icon_name: 'Award' },

  // De Capital
  { id: 'inc-6', name: 'Inversiones', type: 'income', icon_name: 'TrendingUp' },
  { id: 'inc-7', name: 'Transferencias', type: 'income', icon_name: 'ArrowRightLeft' },

  // ==========================================
  // GASTOS
  // ==========================================
  // Nivel 1: Primera Necesidad (Inelásticos)
  { id: 'exp-1', name: 'Vivienda', type: 'expense', icon_name: 'Home' },
  { id: 'exp-2', name: 'Supermercado', type: 'expense', icon_name: 'ShoppingCart' },
  { id: 'exp-3', name: 'Servicios Básicos', type: 'expense', icon_name: 'Zap' },
  { id: 'exp-4', name: 'Salud', type: 'expense', icon_name: 'HeartPulse' },
  { id: 'exp-5', name: 'Transporte', type: 'expense', icon_name: 'Bus' },

  // Nivel 2: Necesidad Operativa (Compromisos)
  { id: 'exp-6', name: 'Celular/Internet', type: 'expense', icon_name: 'Wifi' },
  { id: 'exp-7', name: 'Deudas Bancarias', type: 'expense', icon_name: 'CreditCard' },
  { id: 'exp-8', name: 'Educación', type: 'expense', icon_name: 'BookOpen' },
  { id: 'exp-9', name: 'Seguros de Activos', type: 'expense', icon_name: 'Shield' },

  // Nivel 3: Estilo de Vida (Elásticos)
  { id: 'exp-10', name: 'Restaurante/Delivery', type: 'expense', icon_name: 'Utensils' },
  { id: 'exp-11', name: 'Ocio y Entretención', type: 'expense', icon_name: 'Ticket' },
  { id: 'exp-12', name: 'Compras y Retail', type: 'expense', icon_name: 'ShoppingBag' },
  { id: 'exp-13', name: 'Cuidado Personal', type: 'expense', icon_name: 'Scissors' },
  { id: 'exp-16', name: 'Gastos Hormiga', type: 'expense', icon_name: 'Coffee' },

  // Nivel 4: Patrimonio y Futuro
  { id: 'exp-14', name: 'Ahorro (Emergencia)', type: 'expense', icon_name: 'PiggyBank' },
  { id: 'exp-15', name: 'Inversiones (APV/Acciones)', type: 'expense', icon_name: 'LineChart' },
];


export const getCategories = () => categoriesDb;
export const getCategoriesByType = (type: 'income' | 'expense') => categoriesDb.filter(c => c.type === type);
