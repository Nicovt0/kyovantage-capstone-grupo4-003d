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
  usePin?: boolean;
  useBiometrics?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  settings: UserSettings;
}
