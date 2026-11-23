"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "danger" | "outline" | "ghost" | "brass";
type Size = "sm" | "md" | "big";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-brass text-wood-deep border-brass-deep hover:brightness-110 active:brightness-95 shadow-[0_4px_0_0_var(--color-brass-deep)] active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--color-brass-deep)]",
  brass: "bg-gradient-to-b from-brass to-lamp text-wood-deep border-brass-deep hover:brightness-110",
  danger:
    "bg-blood text-ivory border-blood-bright hover:brightness-110 active:brightness-95 shadow-[0_4px_0_0_var(--color-blood-deep)] active:translate-y-[2px]",
  outline: "bg-transparent text-ivory border-ink-dim/70 hover:border-brass hover:text-brass",
  ghost: "bg-transparent text-ink-dim border-transparent hover:text-ivory",
};

const sizes: Record<Size, string> = {
  sm: "min-h-12 px-4 text-sm",
  md: "min-h-12 px-5 text-base",
  big: "min-h-16 px-6 text-lg",
};

/** Standard button — ≥48px targets everywhere (STR/05 §7). */
export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex touch-manipulation items-center justify-center gap-2 rounded-btn border-2 font-display tracking-wide disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}
