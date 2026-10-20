import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button, Popover, PopoverTrigger, PopoverContent, Calendar } from '@heroui/react';
import { CalendarDate, getLocalTimeZone } from '@internationalized/date';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const FULL_MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface WeeklyNavigatorProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  baseMonday: Date;
  currentWeekDays: Date[];
  hasTransaction: (date: Date) => boolean;
  activeColor?: string;
  dotColor?: string;
}

export function WeeklyNavigator({
  selectedDate,
  onSelectDate,
  weekOffset,
  onWeekOffsetChange,
  baseMonday,
  currentWeekDays,
  hasTransaction,
  activeColor = '#6d28d9',
  dotColor = '#6d28d9'
}: WeeklyNavigatorProps) {
  const [mounted, setMounted] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);

  useEffect(() => setMounted(true), []);

  const formatWeekLabel = (days: Date[]) => {
    if (!days || days.length === 0) return '';
    const first = days[0], last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return FULL_MONTHS_ES[first.getMonth()];
    }
    return `${FULL_MONTHS_ES[first.getMonth()]} – ${FULL_MONTHS_ES[last.getMonth()]}`;
  };

  const handleDatePick = (date: any) => {
    const picked = date.toDate(getLocalTimeZone());
    onSelectDate(picked);

    const day = picked.getDay();
    const diff = picked.getDate() - day + (day === 0 ? -6 : 1);
    const pickedMonday = new Date(picked);
    pickedMonday.setDate(diff);
    pickedMonday.setHours(0, 0, 0, 0);

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const offset = Math.round((pickedMonday.getTime() - baseMonday.getTime()) / msPerWeek);
    onWeekOffsetChange(offset);
    setIsCalendarOpen(false);
  };

  if (!mounted) return <div className="h-[100px] w-full animate-pulse bg-default-100 rounded-3xl" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <Button size="sm" isIconOnly variant="ghost" className="rounded-full bg-default-100 dark:bg-surface-card text-foreground hover:bg-default-200 dark:hover:bg-surface-raised" onClick={() => onWeekOffsetChange(weekOffset - 1)}>
          <ChevronLeft size={18} />
        </Button>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" className="rounded-full font-bold bg-default-100 dark:bg-surface-card text-foreground hover:bg-default-200 dark:hover:bg-surface-raised" onClick={() => {
            onWeekOffsetChange(0);
            onSelectDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
          }}>
            Hoy
          </Button>
          <Popover isOpen={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger>
              <div
                className="relative inline-flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none outline-none"
                onClick={() => setIsCalendarOpen(true)}
              >
                <h3 className="font-bold text-lg md:text-xl text-foreground">{formatWeekLabel(currentWeekDays)}</h3>
                <ChevronDown size={18} className="text-[#5a5a72] dark:text-[#a0a0b8]" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="p-4">
              <div className="[&_button[slot=previous]:hover]:!text-[#6d28d9] [&_button[slot=next]:hover]:!text-[#6d28d9]">
                <Calendar
                  aria-label="Seleccionar fecha"
                  value={new CalendarDate(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate()) as any}
                  onChange={(date) => {
                    if (date) {
                      handleDatePick(date as any);
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button size="sm" isIconOnly variant="ghost" className="rounded-full bg-default-100 dark:bg-surface-card text-foreground hover:bg-default-200 dark:hover:bg-surface-raised" onClick={() => onWeekOffsetChange(weekOffset + 1)}>
          <ChevronRight size={18} />
        </Button>
      </div>

      <div className="flex justify-between md:justify-center md:gap-8 lg:gap-12 w-full max-w-2xl mx-auto px-1 mt-2">
        {currentWeekDays.map((d, i) => {
          const hasTx = hasTransaction(d);
          const isActive = d.getTime() === selectedDate.getTime();
          const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

          return (
            <div
              key={i}
              onClick={() => onSelectDate(d)}
              className="flex flex-col items-center flex-1 md:flex-none cursor-pointer transition-all gap-1.5"
            >
              <span className={`text-[12px] uppercase font-bold ${isActive ? 'text-foreground' : 'text-[#5a5a72] dark:text-[#a0a0b8]'}`}>
                {DAYS_ES[d.getDay()].charAt(0)}
              </span>

              <div className={`flex flex-col items-center justify-center w-[40px] h-[40px] md:w-[46px] md:h-[46px] rounded-full transition-all border-2 ${
                isActive
                  ? 'text-white shadow-md scale-[1.05] border-transparent bg-brand-primary'
                  : isToday
                    ? 'bg-default-50 dark:bg-surface-card hover:bg-default-100 dark:hover:bg-surface-raised text-foreground'
                    : 'bg-default-50 dark:bg-surface-card border-transparent hover:bg-default-100 dark:hover:bg-surface-raised text-foreground'
              }`}
              style={{
                borderColor: (!isActive && isToday) ? activeColor : undefined,
              }}
              >
                <span className={`text-base md:text-lg font-black ${isToday && !isActive ? 'opacity-90' : ''}`}>
                  {d.getDate()}
                </span>
                <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-white' : hasTx ? 'bg-default-400 dark:bg-brand-primary' : 'bg-transparent'}`}
                     style={(!isActive && hasTx) ? { backgroundColor: dotColor } : {}}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
