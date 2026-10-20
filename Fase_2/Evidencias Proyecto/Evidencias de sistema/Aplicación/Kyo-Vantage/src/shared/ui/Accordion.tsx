import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onClick?: () => void;
}

export function AccordionItem({ title, children, isOpen, onClick }: AccordionItemProps) {
  return (
    <div className="border-b border-gray-200/50 dark:border-white/5 last:border-none">
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between py-4 text-left outline-none transition-colors hover:bg-gray-100/50 dark:hover:bg-white/5 rounded-xl px-4"
      >
        <span className="font-semibold text-[15px] text-gray-900 dark:text-white">{title}</span>
        <ChevronDown
          size={18}
          className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-[14px] text-gray-600 dark:text-[#a0a0b8] leading-relaxed pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Accordion({ children }: { children: React.ReactNode }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="w-full flex flex-col gap-1">
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            isOpen: openIndex === index,
            onClick: () => setOpenIndex(openIndex === index ? null : index),
          });
        }
        return child;
      })}
    </div>
  );
}
