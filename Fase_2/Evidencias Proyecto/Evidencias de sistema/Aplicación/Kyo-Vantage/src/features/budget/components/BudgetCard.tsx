import { Budget, Category } from "@/types";
import { Card } from "@heroui/react";
import { Link } from 'react-router-dom';
import * as LucideIcons from "lucide-react";
import { ShoppingCart } from "lucide-react";
import { getBudgetTrafficLight } from "@/utils/budgetTrafficLight";

interface BudgetCardProps {
  budget: Budget;
  category?: Category;
  usedAmount: number;
  currentLimit: number;
  hideProgressBar?: boolean;
}

export function BudgetCard({ budget, category, usedAmount, currentLimit, hideProgressBar }: BudgetCardProps) {
  const IconComponent = category
    ? ((LucideIcons as any)[category.icon_name] || ShoppingCart)
    : ShoppingCart;

  const color = '#a0a0b8';
  const trafficLight = getBudgetTrafficLight(usedAmount, currentLimit, budget.alert_threshold);

  const availableAmount = Math.max(0, currentLimit - usedAmount);

  return (
    <Link to={`/planning?view=budget-detail&id=${budget.id}`} className="block w-full">
      <Card className="bg-white dark:bg-surface-card hover:scale-[1.02] transition-transform w-full border border-transparent dark:border-border-subtle shadow-sm overflow-visible rounded-2xl">
        <div className="p-4 flex flex-col gap-4">

          {/* Top Section */}
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: `${color}20`, color: color }}
              >
                <IconComponent size={20} />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-base text-foreground line-clamp-1">
                  {category?.name || 'Categoría'}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] capitalize">
                    {budget.period === 'weekly' ? 'Semanal' : budget.period === 'monthly' ? 'Mensual' : 'Anual'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${trafficLight.badgeClassName}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${trafficLight.dotClassName}`} aria-hidden="true" />
                    {trafficLight.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <span className="font-light text-xl md:text-2xl tracking-tight">
                ${availableAmount.toLocaleString('es-CL')}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] font-normal">
                Disponible
              </span>
            </div>
          </div>

          {/* Progress Section */}
          {!hideProgressBar && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#5a5a72] dark:text-[#a0a0b8] font-normal">
                  Gastado: ${usedAmount.toLocaleString('es-CL')}
                </span>
                <span className="text-foreground font-normal">
                  ${currentLimit.toLocaleString('es-CL')}
                  {currentLimit > budget.limit_amount && (
                    <span className="text-[9px] text-[#5a5a72] dark:text-[#a0a0b8] font-light ml-1">(+Sobrante)</span>
                  )}
                </span>
              </div>

              <div className="w-full h-2 bg-default-100 dark:bg-surface-card rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${trafficLight.barClassName}`}
                  style={{ width: `${Math.min(100, trafficLight.percentage)}%` }}
                />
              </div>
            </div>
          )}

        </div>
      </Card>
    </Link>
  );
}
