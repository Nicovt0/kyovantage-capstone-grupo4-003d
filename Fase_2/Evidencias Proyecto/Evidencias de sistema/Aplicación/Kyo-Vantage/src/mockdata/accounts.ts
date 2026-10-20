export interface Account {
  id: string;
  user_id?: string;
  name: string;
  bank_id: string | null; // null for Cash
  balance: number;
  current_balance?: number;
  include_in_total: boolean;
  color?: string;
  type?: string;
  last_digits?: string;
}

export const accountsDb: Account[] = [
  {
    id: 'a1',
    name: 'Efectivo',
    bank_id: null,
    balance: 100000,
    include_in_total: true
  },
  {
    id: 'a2',
    name: 'Cuenta Corriente',
    bank_id: '1', // Banco de Chile
    balance: 1245000,
    include_in_total: true
  },
  {
    id: 'a3',
    name: 'Ahorro Vivienda',
    bank_id: '2', // Santander
    balance: 5000000,
    include_in_total: false // Doesn't affect available liquidity
  }
];


export const getAccounts = () => accountsDb;
export const addAccount = (account: Account) => {
  accountsDb.push(account);
  return account;
};
