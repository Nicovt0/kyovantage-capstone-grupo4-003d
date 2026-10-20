import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Menu, Bell, ChevronLeft, Settings } from 'lucide-react';
import { Button } from '@heroui/react';
import { useState, useEffect } from 'react';

export function TopNav() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Prevenir el bug de overscroll/rebote en iOS
      if (currentScrollY <= 0) {
        setIsVisible(true);
        setLastScrollY(currentScrollY);
        return;
      }

      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  let title = '';
  let layout: 'left' | 'back' | 'home' = 'left';

  // Definición de títulos y estilo según la ruta en v3
  if (pathname === '/dashboard') {
    layout = 'home';
  } else if (pathname === '/wallet') {
    title = 'Billetera';
  } else if (pathname.startsWith('/planning/categories')) {
    title = pathname.endsWith('/form') ? (searchParams.get('id') ? 'Editar categoría' : 'Nueva categoría') : 'Categorías';
    layout = 'back';
  } else if (pathname === '/planning') {
    const planningView = searchParams.get('view');
    if (planningView === 'create-budget') {
      title = 'Añadir Presupuesto';
      layout = 'back';
    } else if (planningView === 'create-goal') {
      title = 'Añadir Meta';
      layout = 'back';
    } else if (planningView === 'budget-detail') {
      title = 'Detalle de Presupuesto';
      layout = 'back';
    } else if (planningView === 'goal-detail') {
      title = 'Detalle de Meta';
      layout = 'back';
    } else {
      title = 'Planificación';
    }
  } else if (pathname === '/goals') {
    title = 'Metas';
  } else if (pathname === '/credit-cards') {
    title = 'Tarjetas de Crédito';
  } else if (pathname === '/transactions') {
    title = 'Movimientos';
  } else if (pathname === '/agenda') {
    title = 'Agenda Financiera';
  } else if (pathname === '/budget') {
    title = 'Presupuestos';
  } else if (pathname === '/settings') {
    title = 'Ajustes';
    layout = 'back';
  } else {
    // Si no es una ruta principal, es una subpágina, así que usamos back layout
    layout = 'back';
    if (pathname.includes('/add')) {
      if (pathname.includes('/wallet/transaction')) title = 'Añadir Transacción';
      else if (pathname.includes('/wallet/account')) title = 'Añadir Cuenta';
      else if (pathname.includes('/credit-cards')) title = 'Añadir Tarjeta';
      else if (pathname.includes('/budget')) title = 'Añadir Presupuesto';
      else if (pathname.includes('/goals')) title = 'Añadir Meta';
      else title = 'Añadir';
    } else {
      if (pathname.includes('/wallet/account/')) title = 'Detalle de Cuenta';
      else if (pathname.includes('/wallet/transactions')) title = 'Movimientos';
      else if (pathname.includes('/credit-cards/')) title = 'Detalle de Tarjeta';
      else if (pathname.includes('/budget/')) title = 'Detalle de Presupuesto';
      else if (pathname.includes('/goals/')) title = 'Detalle de Meta';
      else if (pathname.includes('/settings/fixed-incomes')) title = 'Ingresos Fijos';
      else if (pathname.includes('/settings/fixed-expenses')) title = 'Gastos Fijos';
      else if (pathname.includes('/settings/custom-banks')) title = 'Mis Bancos';
      else if (pathname.includes('/settings/custom-categories')) title = 'Mis Categorías';
      else if (pathname.includes('/settings/security')) title = 'Seguridad';
      else if (pathname.includes('/settings/account')) title = 'Perfil';
      else if (pathname.includes('/settings/support')) title = 'Soporte';
      else if (pathname.includes('/notifications')) title = 'Notificaciones';
      else if (pathname.includes('/settings/recurring-items/form')) {
        const typeParam = searchParams.get('type');
        const idParam = searchParams.get('id');
        const entityStr = typeParam === 'income' ? 'Ingreso' : 'Gasto';
        title = idParam ? `Editar ${entityStr}` : `Añadir ${entityStr}`;
      }
      else title = 'Detalle';
    }
  }

  if (!title && layout !== 'home' && layout !== 'back') return null;

  return (
    <header className={`flex items-center justify-between h-[60px] px-5 bg-[var(--color-app-background)] border-b border-black/5 dark:border-border-subtle sticky top-0 z-40 md:hidden transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>

      {/* Izquierda: Back Button y/o Título (si no es home) */}
      <div className="flex items-center">
        {layout === 'back' && (
          <Button isIconOnly variant="ghost" onPress={() => {
            if (pathname === '/settings') {
              const last = sessionStorage.getItem('lastMainRoute') || '/dashboard';
              navigate(last);
            } else if (pathname === '/planning' && searchParams.get('view')) {
              navigate('/planning');
            } else {
              navigate(-1);
            }
          }} className="text-foreground z-10 min-w-10 w-10 h-10 mr-1 -ml-2">
            <ChevronLeft size={24} />
          </Button>
        )}

        {layout !== 'home' && (
          <h1 className="text-lg font-semibold text-foreground m-0 capitalize">
            {title}
          </h1>
        )}
      </div>

      {/* Centro: Logo solo si es home (centrado absoluto) */}
      {layout === 'home' && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <h1 className="font-bold text-lg text-foreground m-0">
            Kyo <span className="text-[#6d28d9]">Vantage</span>
          </h1>
        </div>
      )}

      {/* Derecha: Iconos o Spacer */}
      {layout === 'back' ? (
        <div className="w-[40px]" />
      ) : (
        <div className="flex items-center gap-1 z-10">
          <Button isIconOnly variant="ghost" onPress={() => navigate('/notifications')} className="text-foreground min-w-10 w-10 h-10 border-transparent">
            <Bell size={20} />
          </Button>
          <Button isIconOnly variant="ghost" onPress={() => {
            sessionStorage.setItem('lastMainRoute', pathname);
            navigate('/settings');
          }} className="text-foreground min-w-10 w-10 h-10 border-transparent">
            <Settings size={20} />
          </Button>
        </div>
      )}
    </header>
  );
}
