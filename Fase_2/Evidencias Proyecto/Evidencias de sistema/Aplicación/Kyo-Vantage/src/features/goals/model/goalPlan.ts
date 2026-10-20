import { parseDate } from '@internationalized/date';

export type ContributionType = 'auto' | 'fixed' | 'free';
export function localGoalDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function calculateGoalPlan(input: {
  target: number; current: number; mode: ContributionType; fixed: number; deadline: string; baseDate: string;
}) {
  const { target, current, mode, fixed } = input;
  if (!Number.isFinite(target) || target <= 0) throw new Error('El monto objetivo debe ser mayor a cero.');
  if (!Number.isFinite(current) || current < 0 || current > target) throw new Error('El ahorro no puede ser negativo ni superar el monto objetivo.');
  const base = parseDate(input.baseDate.slice(0,10));
  const remaining = target-current;
  const firstPayment = base.add({months:1});
  if (mode === 'fixed') {
    if (!Number.isFinite(fixed) || fixed <= 0) throw new Error('El abono mensual fijo debe ser mayor a cero.');
    const months = Math.ceil(remaining/fixed);
    if (months > 1200) throw new Error('El plan supera 100 años. Aumenta el abono mensual.');
    return { deadline:base.add({months}).toString(), months, monthly:remaining > 0 ? fixed : 0,
      firstPayment:months ? firstPayment.toString() : null, lastPayment:months ? remaining-fixed*(months-1) : 0, remaining };
  }
  if (!['auto','free'].includes(mode)) throw new Error('Selecciona un modo de abono válido.');
  let deadline;
  try { deadline=parseDate(input.deadline.slice(0,10)); } catch { throw new Error('Selecciona una fecha objetivo válida.'); }
  if (deadline.compare(base)<0) throw new Error('La fecha objetivo no puede ser anterior a hoy.');
  let months=(deadline.year-base.year)*12+deadline.month-base.month;
  if (base.add({months}).compare(deadline)>0) months--;
  if (mode === 'auto' && remaining > 0 && months < 1) throw new Error('El primer abono es el próximo mes. Elige una fecha objetivo desde ese primer abono.');
  const monthly=mode === 'auto' && remaining > 0 ? Math.ceil(remaining/months) : 0;
  return {deadline:deadline.toString(), months:Math.max(0,months), monthly,
    firstPayment:mode === 'auto' && remaining > 0 ? firstPayment.toString() : null,
    lastPayment:monthly ? Math.max(0,remaining-monthly*(months-1)) : 0, remaining};
}
