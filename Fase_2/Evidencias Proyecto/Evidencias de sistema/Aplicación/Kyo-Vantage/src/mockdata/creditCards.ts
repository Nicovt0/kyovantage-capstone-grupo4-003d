export interface CreditCard {
  id: string;
  user_id?: string;
  name: string;
  bank_id: string;
  total_limit: number;
  recommended_threshold: number; // Porcentaje recomendado para no exceder (ej: 30)
  billing_date: number; // Día del mes para la fecha de corte (ej: 15)
  payment_date: number; // Día del mes para la fecha de pago (ej: 5)
  maintenance_cost: number;
  monthly_interest_rate: number; // Porcentaje de interés (ej: 2.5)
  type: string; // Ej: "Gold", "Signature", "Black"
  issuer: 'visa' | 'mastercard' | 'amex' | 'other';
  last_4_digits?: number;
}

// Por defecto el usuario no tiene ninguna tarjeta de crédito, pero agregamos unas de prueba
export const creditCardsDb: CreditCard[] = [
  {
    id: 'cc1',
    name: 'Visa Gold',
    bank_id: '1',
    total_limit: 250000,
    recommended_threshold: 30,
    billing_date: 15,
    payment_date: 5,
    maintenance_cost: 0,
    monthly_interest_rate: 2.5,
    type: 'Gold',
    issuer: 'visa',
    last_4_digits: 4821
  },
  {
    id: 'cc2',
    name: 'Mastercard Platinum',
    bank_id: '2',
    total_limit: 500000,
    recommended_threshold: 30,
    billing_date: 22,
    payment_date: 10,
    maintenance_cost: 5000,
    monthly_interest_rate: 1.5,
    type: 'Platinum',
    issuer: 'mastercard',
    last_4_digits: 3307
  }
];


export const getCreditCards = () => creditCardsDb;
export const addCreditCard = (card: CreditCard) => {
  creditCardsDb.push(card);
  return card;
};
