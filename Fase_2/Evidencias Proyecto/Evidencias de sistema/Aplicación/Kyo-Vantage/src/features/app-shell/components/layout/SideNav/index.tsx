import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, CreditCard, Coins, Flag, Settings, Plus, Bell, CalendarDays } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { prefetchRoute } from "@/lib/prefetchRoutes";
import { AuthLogo } from "@/features/auth/components/AuthLogo";
import { TransactionModal } from "@/features/wallet/components/transaction/TransactionModal";

export function SideNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
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
    <aside className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 bg-[#F2F2F7] dark:bg-surface-card border-r border-border-subtle px-4 py-6 z-50">
      <div className="mb-8 w-full flex items-center justify-center min-h-[60px]">
        {/* Logo Tema Claro */}
        <img
          src="/Logo_1920x1920_white_transparent.png"
          alt="Kyo Vantage Logo Light"
          width={180}
          height={60} fetchPriority="high"
          className="w-[160px] md:w-[180px] h-auto object-contain drop-shadow-[0_0_15px_rgba(124,58,237,0.4)] block dark:hidden"
          style={{ width: '100%', height: 'auto' }}
        />
        {/* Logo Tema Oscuro */}
        <img
          src="/Logo_1920x1920_clean.png"
          alt="Kyo Vantage Logo Dark"
          width={180}
          height={60} fetchPriority="high"
          className="w-[160px] md:w-[180px] h-auto object-contain drop-shadow-[0_0_15px_rgba(124,58,237,0.4)] hidden dark:block"
          style={{ width: '100%', height: 'auto' }}
        />
      </div>

      <div className="w-full mb-8">
        <Button
          onPress={() => setIsTxModalOpen(true)}
          className="w-full font-bold text-white bg-brand-primary shadow-lg shadow-brand-primary/30 rounded-2xl"
          size="lg"
        >
          <Plus size={20} />
          Añadir Transacción
        </Button>
      </div>

      <nav className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-3 mb-2">
          <div className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-[0.1em]">Menú Principal</div>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={() => navigate('/notifications')}
            className="w-6 h-6 min-w-6 text-[#a0a0b8] hover:bg-kyo-lightPurple/10 hover:text-kyo-lightPurple rounded-full"
          >
            <Bell size={14} />
          </Button>
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.href}
              onMouseEnter={() => prefetchRoute(queryClient, item.href, auth?.id)}
              onFocus={() => prefetchRoute(queryClient, item.href, auth?.id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-surface-raised text-on-background font-bold'
                  : 'text-[#5a5a72] dark:text-[#a0a0b8] hover:bg-default-100 dark:hover:bg-default-50 hover:text-foreground font-medium'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[14px]">{item.name}</span>
            </Link>
          );
        })}
      </nav>


    </aside>
    <TransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} />
    </>
  );
}
