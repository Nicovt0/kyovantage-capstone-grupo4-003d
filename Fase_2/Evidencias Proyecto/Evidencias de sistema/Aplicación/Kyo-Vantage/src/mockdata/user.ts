export interface FixedItem {
  id: string;
  name: string;
  amount: number;
  category?: string;
}

export interface UserSettings {
  currency: string;
  language: string;
  theme: 'dark' | 'light';
  isCashAccountEnabled?: boolean;
  fixedIncomes?: FixedItem[];
  fixedExpenses?: FixedItem[];
}


export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  settings: UserSettings;
}


export const mockUser: User = {
  id: "u1",
  name: "Nicolás",
  email: "nicolas@ejemplo.com",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nico",
  settings: {
    currency: 'CLP',
    language: 'es',
    theme: 'dark',
    isCashAccountEnabled: true,
    fixedIncomes: [
      { id: 'i1', name: 'Sueldo', amount: 900000 },
      { id: 'i2', name: 'Ventas Freelance', amount: 150000 }
    ],
    fixedExpenses: [
      { id: 'e1', name: 'Luz', amount: 35000, category: 'Basic Services' },
      { id: 'e2', name: 'Agua', amount: 18000, category: 'Basic Services' },
      { id: 'e3', name: 'Gas', amount: 25000, category: 'Basic Services' },
      { id: 'e4', name: 'Arriendo', amount: 450000, category: 'Housing' }
    ]
  }
};

