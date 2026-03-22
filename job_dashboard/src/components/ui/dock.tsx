"use client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { type PropsWithChildren, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const DEFAULT_MAGNIFICATION = 52;
const DEFAULT_DISTANCE = 120;

export interface DockProps {
  className?: string;
  magnification?: number;
  distance?: number;
  children: React.ReactNode;
}

export interface DockIconProps {
  magnification?: number;
  distance?: number;
  mouseX?: ReturnType<typeof useMotionValue<number>>;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  label?: string;
}

export const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  ({ className = "", children, magnification = DEFAULT_MAGNIFICATION, distance = DEFAULT_DISTANCE }, ref) => {
    const mouseX = useMotionValue(Infinity);

    const renderChildren = () =>
      React.Children.map(children, (child) => {
        if (React.isValidElement(child) && (child.type as React.FC).displayName === "DockIcon") {
          return React.cloneElement(child as React.ReactElement<DockIconProps>, {
            mouseX,
            magnification,
            distance,
          });
        }
        return child;
      });

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className={`flex items-end h-14 gap-2 px-3 py-2 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/60 ${className}`}
      >
        {renderChildren()}
      </motion.div>
    );
  }
);
Dock.displayName = "Dock";

export const DockIcon = ({
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  mouseX,
  className = "",
  children,
  onClick,
  label,
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const fallbackMouseX = useMotionValue(Infinity); // always called unconditionally
  const mv = mouseX ?? fallbackMouseX;             // pick which value to use after

  const distanceCalc = useTransform(mv, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distanceCalc, [-distance, 0, distance], [36, magnification, 36]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      onClick={onClick}
      title={label}
      className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg ${className}`}
    >
      {children}
    </motion.div>
  );
};
DockIcon.displayName = "DockIcon";