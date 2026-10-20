import { useRef } from 'react';
import { createAccountingAction } from '../model/accountingRequest';

export function useAccountingAction() {
  const action = useRef<ReturnType<typeof createAccountingAction> | null>(null);
  action.current ??= createAccountingAction();
  return action.current;
}
