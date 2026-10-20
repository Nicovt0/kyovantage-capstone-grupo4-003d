import { Account, Bank } from "@/types";
import { Card } from "@heroui/react";
import { Link } from 'react-router-dom';
import { Landmark, PiggyBank, Eye } from "lucide-react";

interface AccountCardProps {
  account: Account;
  bank?: Bank;
  percentage?: number;
}

export function AccountCard({ account, bank, percentage }: AccountCardProps) {
  const getIcon = () => {
    switch (account.type) {
      case 'corriente': return Landmark;
      case 'ahorro': return PiggyBank;
      case 'vista': return Eye;
      default: return Landmark;
    }
  };

  const Icon = getIcon();

  return (
    <Link to={`/wallet/account/detail?id=${account.id}`} className="block w-full">
      <Card className="bg-white dark:bg-surface-card hover:scale-[1.02] transition-transform w-full border border-transparent dark:border-border-subtle shadow-sm rounded-2xl">
        <div className="p-4 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: account.color || bank?.color || '#6d28d9' }}
            >
              <Icon size={20} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium text-base text-foreground truncate block">{account.name}</span>
              <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8] font-normal truncate block">
                {bank?.name || 'Efectivo/Sin Banco'} {account.last_digits && `• ${account.last_digits}`}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="font-light text-xl md:text-2xl text-foreground tracking-tight">
              ${account.balance.toLocaleString('es-CL')}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#5a5a72] dark:text-[#a0a0b8] flex gap-1 items-center font-normal">
              <span>{account.type}</span>
              {percentage !== undefined && (
                <>
                  <span>·</span>
                  <span className="font-medium text-foreground">{percentage.toFixed(1)}%</span>
                </>
              )}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
