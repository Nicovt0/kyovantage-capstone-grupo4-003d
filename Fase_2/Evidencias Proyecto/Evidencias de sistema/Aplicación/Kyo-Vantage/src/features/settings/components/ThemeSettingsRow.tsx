import { useTheme } from "@/shared/theme/ThemeProvider";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeSettingsRow() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return (
    <div className="flex items-center gap-4 p-4 pr-6 opacity-50 cursor-not-allowed">
      <div className="w-10 h-10 rounded-xl bg-default-100 dark:bg-surface-raised text-[#6d28d9] flex items-center justify-center">
        <Moon size={20} />
      </div>
      <div className="flex-1 flex flex-col">
        <span className="font-bold text-[15px] text-foreground">Tema Visual</span>
        <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Cargando preferencia...</span>
      </div>
    </div>
  );

  return (
    <div
      className="flex items-center gap-4 p-4 pr-6 hover:bg-default-50 dark:hover:bg-surface-card transition-colors group cursor-pointer"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <div className="w-10 h-10 rounded-xl bg-default-100 dark:bg-surface-raised text-[#6d28d9] flex items-center justify-center transition-colors group-hover:bg-brand-primary group-hover:text-white shadow-sm">
        {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
      </div>
      <div className="flex-1 flex flex-col">
        <span className="font-bold text-[15px] text-foreground">Tema Visual</span>
        <span className="text-xs text-[#5a5a72] dark:text-[#a0a0b8]">Cambiar a modo {theme === 'dark' ? 'claro' : 'oscuro'}</span>
      </div>
    </div>
  );
}
