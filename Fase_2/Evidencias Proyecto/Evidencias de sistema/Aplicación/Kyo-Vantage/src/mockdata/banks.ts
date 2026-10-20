import { Bank } from '@/types/bank';

export type { Bank };

export const banksDb: Bank[] = [
  { id: '1', name: 'Banco de Chile', color: '#002464' },
  { id: '2', name: 'Santander', color: '#EC0000' },
  { id: '3', name: 'BCI', color: '#000000' },
  { id: '4', name: 'BancoEstado', color: '#FF6A00' },
  { id: '5', name: 'Falabella', color: '#B2D235' },
];

export const getBanks = () => banksDb;
