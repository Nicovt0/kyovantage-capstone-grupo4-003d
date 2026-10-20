import { Transaction } from "@/types";

/**
 * Agrupa visualmente transacciones de transferencia que están registradas como 2 filas (egreso e ingreso)
 * en un solo objeto visual de tipo 'transfer'.
 */
export function groupTransactions(transactions: Transaction[]): Transaction[] {
  const grouped: Transaction[] = [];
  const skipIds = new Set<string>();

  // Ordenar por fecha desc
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i];
    if (skipIds.has(tx.id)) continue;

    // Si tiene transfer_group_id, buscar su par exacto
    if (tx.transfer_group_id) {
      const isExpense = tx.type === 'expense';
      const pairIndex = sorted.findIndex((other, idx) => 
        idx !== i && 
        other.transfer_group_id === tx.transfer_group_id
      );

      if (pairIndex !== -1) {
        const pair = sorted[pairIndex];
        skipIds.add(pair.id);

        const expenseTx = isExpense ? tx : pair;
        const incomeTx = isExpense ? pair : tx;

        let cleanName = expenseTx.name || 'Transferencia';
        cleanName = cleanName.replace(/ enviada/i, '').trim();

        grouped.push({
          ...expenseTx,
          type: 'transfer',
          name: cleanName,
          destination_account_id: incomeTx.account_id,
          id: `${expenseTx.id}_${incomeTx.id}`,
          transfer_group_id: tx.transfer_group_id,
          origin_transaction_id: expenseTx.id,
          destination_transaction_id: incomeTx.id
        });
        continue;
      }
    }

    grouped.push(tx);
  }

  return grouped;
}
