import { useState, useEffect, useRef } from "react";

export function WheelPicker({
  items,
  value,
  onChange,
  format = (v: any) => String(v),
  height = 130,
  itemHeight = 44
}: {
  items: any[],
  value: any,
  onChange: (v: any) => void,
  format?: (v: any) => string,
  height?: number,
  itemHeight?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar el valor inicial o cambios externos
  useEffect(() => {
    if (containerRef.current && !isScrolling) {
      const index = items.indexOf(value);
      if (index !== -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, [value, items, itemHeight, isScrolling]);

  // Manejar el scroll con la rueda del ratón (Desktop) para tener libertad y precisión
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let accumulatedDelta = 0;
    let wheelTimeout: NodeJS.Timeout;
    let targetScroll = el.scrollTop;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      accumulatedDelta += e.deltaY;

      // Threshold de 50 para registrar un movimiento
      if (Math.abs(accumulatedDelta) >= 50) {
         // Calculamos cuántos ítems mover (1 tick normal suele ser ~100 de deltaY = 1 ítem)
         let itemsToMove = Math.round(accumulatedDelta / 100);
         if (itemsToMove === 0) itemsToMove = Math.sign(accumulatedDelta);

         // Sincronizar el target si el scroll nativo está muy lejos
         if (Math.abs(el.scrollTop - targetScroll) > itemHeight) {
            targetScroll = Math.round(el.scrollTop / itemHeight) * itemHeight;
         }

         targetScroll += itemsToMove * itemHeight;

         // Limitar a los bordes
         const maxScroll = (items.length - 1) * itemHeight;
         targetScroll = Math.max(0, Math.min(maxScroll, targetScroll));

         el.scrollTo({ top: targetScroll, behavior: 'smooth' });

         accumulatedDelta = 0;
      }

      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        accumulatedDelta = 0;
        if (el) targetScroll = el.scrollTop;
      }, 150);
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, [items.length, itemHeight]);


  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolling(true);
    const top = e.currentTarget.scrollTop;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(top / itemHeight)));
    const newValue = items[index];

    if (newValue !== undefined && newValue !== value) {
      onChange(newValue);
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>

      {/* Difuminado superior e inferior */}
      <div className="absolute top-0 w-full h-[25%] bg-gradient-to-b from-default-50/80 dark:from-surface-card to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 w-full h-[25%] bg-gradient-to-t from-default-50/80 dark:from-surface-card to-transparent pointer-events-none z-10" />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto hide-scrollbar snap-y snap-mandatory scroll-smooth"
        style={{ padding: `${(height - itemHeight) / 2}px 0` }}
      >
        {items.map(item => (
          <div
            key={item}
            onClick={() => {
              onChange(item);
              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: items.indexOf(item) * itemHeight,
                  behavior: 'smooth'
                });
              }
            }}
            className="flex items-center justify-center font-bold snap-center transition-all duration-200 cursor-pointer"
            style={{
              height: itemHeight,
              fontSize: item === value ? '20px' : '15px',
              opacity: item === value ? 1 : 0.4,
              color: item === value ? '#6d28d9' : 'inherit'
            }}
          >
            {format(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
