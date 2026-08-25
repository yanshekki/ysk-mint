import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-brand-blue text-white shadow-sm hover:brightness-110"
      : "border border-border bg-white text-text-main hover:bg-slate-50";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
