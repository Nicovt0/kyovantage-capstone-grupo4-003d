import { useMemo, useState } from "react";
import { AgendaEvent } from "./AgendaOverview";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@heroui/react";

interface AgendaCalendarProps {
  events: AgendaEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPay: (event: AgendaEvent) => void;
}

const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAYS_ES = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

export function AgendaCalendar({ events, selectedDate, onSelectDate, onPay }: AgendaCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const eventsMap = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    events.forEach(e => {
      const dateStr = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(e);
    });
    return map;
  }, [events]);

  const selectedDateStr = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const selectedDayEvents = eventsMap.get(selectedDateStr) || [];

  const getUrgencyColors = (targetDate: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { color: "#f31260", rgbColor: "243,18,96", btn: "text-white bg-[#f31260] hover:bg-[#f31260]/90" };
    } else if (diff === 0) {
      return { color: "#f5a524", rgbColor: "245,165,36", btn: "text-[#f5a524] bg-[#f5a524]/10 hover:bg-[#f5a524]/20" };
    } else if (diff <= 7) {
      return { color: "#eab308", rgbColor: "234,179,8", btn: "text-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20" };
    } else {
      return { color: "#17c964", rgbColor: "23,201,100", btn: "text-[#17c964] bg-[#17c964]/10 hover:bg-[#17c964]/20" };
    }
  };

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return events.filter(e => e.date.getTime() >= today.getTime());
  }, [events]);

  const overdueEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return events.filter(e => e.date.getTime() < today.getTime());
  }, [events]);

  const displayEvents = selectedDayEvents.length > 0 ? selectedDayEvents : upcomingEvents;
  const showOverdue = selectedDayEvents.length === 0 && overdueEvents.length > 0;

  const renderEventCard = (event: AgendaEvent, isOverdueList: boolean = false) => {
    const { color, rgbColor, btn } = getUrgencyColors(event.date);
    const isGoal = event.subtitle === "Meta de ahorro";
    const amountColor = event.isIncome ? "text-[#17c964]" : (isGoal ? "text-foreground dark:text-white" : "text-[#f31260]");
    const amountSign = event.isIncome ? "+" : (isGoal ? "" : "-");
    const diff = Math.round((new Date(event.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));

    let statusText = "";
    if (diff < 0) statusText = "VENCIDO";
    else if (diff === 0) statusText = "HOY";
    else if (diff === 1) statusText = "MAÑANA";
    else statusText = `EN ${diff} DÍAS`;

    return (
      <div key={event.id} className="rounded-[20px] border bg-white dark:bg-surface-card p-5 flex flex-col gap-2 relative overflow-hidden group transition-colors" style={{ borderColor: color, boxShadow: `0 0 15px rgba(${rgbColor},0.15)` }}>
        <div className="absolute top-[-30%] right-[-10%] w-[50%] h-[150%] blur-2xl pointer-events-none rounded-full" style={{ backgroundColor: `${color}1A` }} />

        <span className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-1" style={{ color: color }}>
          DÍA {event.date.getDate()} • {isOverdueList ? `${MONTHS_ES[event.date.getMonth()]} (VENCIDO)` : statusText}
        </span>
        <h3 className="text-foreground dark:text-white font-semibold text-[17px] truncate pr-4 mt-1">
          {event.title}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-default-500 text-[13px]">{event.subtitle}</span>
          <div className="flex items-center gap-3">
            <span className={`font-bold text-[15px] ${amountColor}`}>
              {amountSign}${event.amount.toLocaleString("es-CL")}
            </span>
            <button
              onClick={() => onPay(event)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors z-10 relative ${btn}`}
            >
              {event.isIncome ? "Cobrar" : (isGoal ? "Aportar" : "Pagar")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground dark:text-white tracking-tight">
          {MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const today = new Date();
              setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(today);
            }}
            className="px-3 h-8 rounded-xl bg-default-200 hover:bg-default-300 dark:bg-surface-raised dark:hover:bg-surface-raised text-xs font-semibold text-foreground dark:text-white flex items-center justify-center transition-colors mr-1"
          >
            Hoy
          </button>
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl bg-default-200 hover:bg-default-300 dark:bg-surface-raised dark:hover:bg-surface-raised text-foreground dark:text-white flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl bg-default-200 hover:bg-default-300 dark:bg-surface-raised dark:hover:bg-surface-raised text-foreground dark:text-white flex items-center justify-center transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-7 gap-1">
          {DAYS_ES.map(day => (
            <div key={day} className="text-[10px] font-bold text-center text-default-400 py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-2 gap-x-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}-${day}`;
            const dayEvents = eventsMap.get(dateStr) || [];

            const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth.getMonth() && selectedDate.getFullYear() === currentMonth.getFullYear();
            const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear();

            const hasOverdue = dayEvents.some(e => e.date.getTime() < new Date().setHours(0,0,0,0));
            const hasPending = dayEvents.length > 0;

            return (
              <button
                key={day}
                onClick={() => onSelectDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                className={`relative h-10 w-full flex items-center justify-center rounded-xl text-sm transition-colors ${
                  isSelected
                    ? "bg-brand-primary text-white font-bold shadow-md shadow-[#6d28d9]/30"
                    : isToday
                      ? "bg-default-100 dark:bg-surface-raised text-foreground font-bold hover:bg-default-200 dark:hover:bg-surface-raised"
                      : "text-foreground hover:bg-default-100 dark:hover:bg-surface-raised"
                }`}
              >
                {day}
                {hasPending && !isSelected && (
                  <div className={`absolute bottom-1 w-1 h-1 rounded-full ${hasOverdue ? "bg-[#f31260]" : "bg-brand-primary"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Events List */}
      <div className="flex flex-col gap-4 mt-2">

        {showOverdue && (
          <>
            <h3 className="text-sm font-bold text-[#f31260] flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#f31260]" />
              Atrasados
            </h3>
            {(showAllOverdue ? overdueEvents : overdueEvents.slice(0, 2)).map(event => renderEventCard(event, true))}

            {overdueEvents.length > 2 && (
              <button
                onClick={() => setShowAllOverdue(!showAllOverdue)}
                className="w-full text-xs font-bold text-default-500 hover:text-foreground py-2 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllOverdue ? (
                  <>Ocultar <ChevronUp size={14} /></>
                ) : (
                  <>Ver {overdueEvents.length - 2} más <ChevronDown size={14} /></>
                )}
              </button>
            )}

            <div className="h-px w-full bg-default-200 dark:bg-surface-raised my-2"></div>
          </>
        )}

        <h3 className="text-sm font-semibold text-default-500 mb-1">
          {selectedDayEvents.length > 0 ? `Eventos del ${selectedDate.getDate()} de ${MONTHS_ES[selectedDate.getMonth()]}` : "Próximos Vencimientos"}
        </h3>

        {displayEvents.length > 0 ? (
          displayEvents.map(event => renderEventCard(event, false))
        ) : (
          !showOverdue && (
            <div className="rounded-[20px] border border-default-200 dark:border-border-subtle bg-white dark:bg-surface-card p-5 flex flex-col items-center justify-center gap-2 h-[120px]">
              <span className="text-default-500 text-[13px]">No hay próximos eventos</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
