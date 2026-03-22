import * as React from "react";

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

type BadgeVariant =
  | "default"
  | "amber"
  | "green"
  | "red"
  | "zinc"
  | "blue"
  | "outline";

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-zinc-800 border-zinc-700 text-zinc-300",
  amber:
    "bg-amber-500/10 border-amber-500/30 text-amber-400",
  green:
    "bg-green-500/10 border-green-500/30 text-green-400",
  red:
    "bg-red-500/10 border-red-500/30 text-red-400",
  zinc:
    "bg-zinc-800/60 border-zinc-700/40 text-zinc-500",
  blue:
    "bg-blue-500/10 border-blue-500/30 text-blue-400",
  outline:
    "bg-transparent border-zinc-700 text-zinc-400",
};

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap shrink-0 transition-colors duration-200",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
export type { BadgeVariant };