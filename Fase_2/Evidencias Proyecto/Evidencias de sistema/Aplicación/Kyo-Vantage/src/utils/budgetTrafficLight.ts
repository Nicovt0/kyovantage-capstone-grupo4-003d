export type BudgetTrafficLightStatus = 'green' | 'yellow' | 'red';

export interface BudgetTrafficLight {
  status: BudgetTrafficLightStatus;
  label: string;
  percentage: number;
  alertThreshold: number;
  alertEnabled: boolean;
  earlyAlertReached: boolean;
  barClassName: string;
  badgeClassName: string;
  dotClassName: string;
}

const presentations: Record<BudgetTrafficLightStatus, Omit<BudgetTrafficLight, 'percentage' | 'alertThreshold' | 'alertEnabled' | 'earlyAlertReached'>> = {
  green: {
    status: 'green',
    label: 'En control',
    barClassName: 'bg-[#17c964]',
    badgeClassName: 'bg-[#17c964]/10 text-[#15803d] dark:text-[#17c964]',
    dotClassName: 'bg-[#17c964]',
  },
  yellow: {
    status: 'yellow',
    label: 'Advertencia',
    barClassName: 'bg-[#eab308]',
    badgeClassName: 'bg-[#eab308]/10 text-[#a16207] dark:text-[#facc15]',
    dotClassName: 'bg-[#eab308]',
  },
  red: {
    status: 'red',
    label: 'Presupuesto superado',
    barClassName: 'bg-[#f31260]',
    badgeClassName: 'bg-[#f31260]/10 text-[#be123c] dark:text-[#fb7185]',
    dotClassName: 'bg-[#f31260]',
  },
};

/** Visual bands are fixed; user preferences control optional early notifications only. */
export function getBudgetTrafficLight(
  spent: number,
  currentLimit: number,
  configuredAlertThreshold?: number | null,
): BudgetTrafficLight {
  const configuredThreshold = Number.isFinite(configuredAlertThreshold)
    ? configuredAlertThreshold as number
    : 80;
  const alertEnabled = configuredThreshold > 0;
  const alertThreshold = alertEnabled ? Math.min(configuredThreshold, 100) : 100;

  const normalizedSpent = Number.isFinite(spent) ? Math.max(spent, 0) : 0;
  const normalizedLimit = Number.isFinite(currentLimit) ? Math.max(currentLimit, 0) : 0;
  const percentage = normalizedLimit > 0
    ? (normalizedSpent / normalizedLimit) * 100
    : normalizedSpent > 0 ? Infinity : 0;

  const status: BudgetTrafficLightStatus = percentage > 100
    ? 'red'
    : percentage >= 80 ? 'yellow' : 'green';

  return {
    ...presentations[status],
    earlyAlertReached: alertEnabled && percentage >= alertThreshold,
    percentage,
    alertThreshold,
    alertEnabled,
  };
}
