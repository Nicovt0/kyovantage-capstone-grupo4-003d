import { useTheme } from "@/shared/theme/ThemeProvider";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-10 h-10" />; // Placeholder to avoid layout shift

  return (
    <button
      className="flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-default-100 dark:bg-kyo-card border border-divider text-foreground font-medium hover:opacity-80 transition-opacity"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
    </button>
  );
}
