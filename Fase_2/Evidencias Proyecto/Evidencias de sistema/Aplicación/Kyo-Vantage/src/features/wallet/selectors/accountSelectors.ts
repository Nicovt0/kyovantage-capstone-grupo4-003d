import type { Account } from '@/types';

/**
 * Stable selector for active, non-archived accounts.
 */
export const selectActiveAccounts = (accounts: Account[]): Account[] => {
  return accounts.filter((acc) => !acc.is_archived && acc.is_active !== false);
};

/** Payment sources allowed in the transaction modal; credit cards are supplied separately. */
export function selectTransactionAccounts(accounts: Account[], type: 'expense' | 'income' | 'transfer'): Account[] {
  const active = selectActiveAccounts(accounts);
  if (type === 'transfer') return active;
  const aliases: Record<string, string> = { checking: 'corriente', sight: 'vista', savings: 'ahorro' };
  const normalize = (account: Account) => {
    const value = account.type?.trim().toLowerCase() || '';
    return aliases[value] || value;
  };
  const order = type === 'expense' ? ['corriente', 'vista'] : ['vista', 'ahorro', 'corriente'];
  return active.filter(account => order.includes(normalize(account)))
    .sort((a, b) => order.indexOf(normalize(a)) - order.indexOf(normalize(b)));
}

/**
 * Stable selector calculating total balance across unarchived accounts.
 */
export const selectAccountsTotalBalance = (accounts: Account[]): number => {
  return accounts.reduce((sum, acc) => {
    if (acc.is_archived || acc.is_active === false || acc.include_in_total === false) return sum;
    const val = Number(acc.balance || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
};
