/**
 * Utilidades para cálculos financieros.
 */

/**
 * Calcula el valor de la cuota fija mensual usando el Sistema de Amortización Francés.
 * Este es el estándar utilizado en Chile y la mayoría de países para "Cuotas con Interés"
 * en tarjetas de crédito y créditos de consumo.
 * 
 * Fórmula: Cuota = Capital * [ (i * (1+i)^n) / ((1+i)^n - 1) ]
 * 
 * @param amount El monto total de la compra o capital inicial.
 * @param months El número total de cuotas (meses).
 * @param monthlyInterestRate El porcentaje de interés mensual (ej. 2.5 para 2.5%).
 * @returns El monto exacto de la cuota mensual (redondeado al entero más cercano).
 */
export function calculateFixedInstallment(
  amount: number,
  months: number,
  monthlyInterestRate: number
): number {
  if (months <= 0) return amount;
  if (monthlyInterestRate <= 0) return Math.round(amount / months);

  // Convertir porcentaje a decimal (ej. 2.5% -> 0.025)
  const i = monthlyInterestRate / 100;
  
  // (1 + i)^n
  const factor = Math.pow(1 + i, months);
  
  // Cuota = Capital * [ (i * factor) / (factor - 1) ]
  const installment = amount * ((i * factor) / (factor - 1));
  
  return Math.round(installment);
}
