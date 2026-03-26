/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { ChevronDown } from "lucide-react";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function useClickAway(
  ref: React.RefObject<HTMLElement>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export interface DropdownOption {
  id: string;
  label: string;
  dotColor?: string;
  textColor?: string;
  bg?: string;
  border?: string;
}

interface FluidDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: "beforeChildren", staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function FluidDropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
}: FluidDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useClickAway(dropdownRef as React.RefObject<HTMLElement>, () => setIsOpen(false));

  const selected = options.find((o) => o.id === value) ?? options[0];
  const hoveredIndex = options.findIndex(
    (o) => o.id === (hoveredId ?? selected.id)
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("relative w-full", className)} ref={dropdownRef}>
        {/* Trigger */}
        <button
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200",
            selected.bg ?? "bg-zinc-800/60",
            selected.border ?? "border-zinc-700/50",
            selected.textColor ?? "text-zinc-300",
            "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selected.dotColor && (
              <span
                className={cn("h-2 w-2 flex-shrink-0 rounded-full", selected.dotColor)}
              />
            )}
            <span className="truncate">{selected.label}</span>
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </motion.div>
        </button>

        {/* Dropdown panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{
                opacity: 1,
                height: "auto",
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 0.8 },
              }}
              exit={{
                opacity: 0,
                height: 0,
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 0.8 },
              }}
              className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden"
            >
              <motion.div
                className="rounded-xl border border-zinc-700/60 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl"
                style={{ transformOrigin: "top" }}
              >
                <motion.div
                  className="relative py-1"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  role="listbox"
                >
                  {/* Sliding highlight */}
                  <motion.div
                    className="absolute inset-x-1 rounded-lg bg-zinc-800/80"
                    animate={{
                      y: hoveredIndex * 36,
                      height: 36,
                    }}
                    transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
                  />

                  {options.map((option) => (
                    <motion.button
                      key={option.id}
                      role="option"
                      aria-selected={option.id === selected.id}
                      onClick={() => {
                        onChange(option.id);
                        setIsOpen(false);
                      }}
                      onHoverStart={() => setHoveredId(option.id)}
                      onHoverEnd={() => setHoveredId(null)}
                      className="relative flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-medium focus:outline-none"
                      variants={itemVariants}
                      whileTap={{ scale: 0.98 }}
                    >
                      {option.dotColor && (
                        <span
                          className={cn("h-2 w-2 flex-shrink-0 rounded-full", option.dotColor)}
                        />
                      )}
                      <span
                        className={cn(
                          "transition-colors duration-150",
                          option.id === selected.id
                            ? option.textColor ?? "text-zinc-100"
                            : "text-zinc-400"
                        )}
                      >
                        {option.label}
                      </span>
                      {option.id === selected.id && (
                        <motion.span
                          layoutId="checkmark"
                          className="ml-auto text-blue-400"
                        >
                          ✓
                        </motion.span>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}