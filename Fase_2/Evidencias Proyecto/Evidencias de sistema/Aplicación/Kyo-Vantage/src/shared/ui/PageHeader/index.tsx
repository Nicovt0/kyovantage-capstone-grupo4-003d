import { Button } from "@heroui/react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  showBack?: boolean;
  backUrl?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, showBack = false, backUrl, action }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="hidden md:flex flex-col gap-2 mb-6">
      {showBack && (
        <div className="hidden md:flex">
          <Button
            variant="ghost"
            onPress={() => backUrl ? navigate(backUrl) : navigate(-1)}
            className="text-[#5a5a72] dark:text-[#a0a0b8] hover:text-foreground pl-1 pr-3 -ml-2 h-8 flex items-center gap-2"
          >
            <ChevronLeft size={18} />
            Volver
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="hidden md:block text-2xl md:text-3xl font-light tracking-wide">{title}</h1>
          {description && <p className="text-sm text-[#5a5a72] dark:text-[#a0a0b8] mt-1 font-normal">{description}</p>}
        </div>
        {action && (
          <div>{action}</div>
        )}
      </div>
    </div>
  );
}
