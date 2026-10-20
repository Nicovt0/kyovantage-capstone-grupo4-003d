import { Link, useLocation } from 'react-router-dom';
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { prefetchRoute } from "@/lib/prefetchRoutes";
import { Home, Wallet, Flag, Settings, Plus, CalendarDays } from "lucide-react";
import { TransactionModal } from "@/features/wallet/components/transaction/TransactionModal";

export function BottomNav() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  const navItems = [
    { name: "Inicio", href: "/dashboard", icon: Home },
    { name: "Billetera", href: "/wallet", icon: Wallet },
    { name: "Planificación", href: "/planning", icon: Flag },
    { name: "Agenda", href: "/agenda", icon: CalendarDays },
    { name: "Ajustes", href: "/settings", icon: Settings }
  ];

  return (
    <>
      {/* Botón flotante para añadir transacciones (Móvil) */}
      <button 
        type="button"
        onClick={() => setIsTxModalOpen(true)}
        className="md:hidden fixed bottom-[80px] right-4 w-14 h-14 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-[#6d28d9]/40 z-50 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
      >
        <Plus size={30} />
      </button>
      <TransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} />

      <nav className="md:hidden fixed -bottom-1 left-0 right-0 h-[4.25rem] pb-1 bg-surface-navbar backdrop-blur-md border-t border-border-subtle z-40 px-1">
      <div className="flex justify-around items-center h-full max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.href}
              onTouchStart={() => prefetchRoute(queryClient, item.href, auth?.id)}
              onMouseEnter={() => prefetchRoute(queryClient, item.href, auth?.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors flex-1 min-w-[48px] cursor-pointer ${
                isActive ? 'text-kyo-lightPurple' : 'text-default-400 hover:text-default-500 hover:bg-default-100 dark:hover:bg-default-50'
              }`}
            >
              <div className="relative flex items-center justify-center w-10 h-10 transition-colors">
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-[3px] w-[6px] -translate-x-1/2 rounded-full bg-brand-primary" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
