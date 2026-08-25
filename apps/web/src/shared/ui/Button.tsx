import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "grad";
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-[13px] font-bold transition disabled:opacity-45";
  const styles =
    variant === "grad"
      ? "btn-grad"
      : variant === "primary"
        ? "bg-text-main text-white hover:bg-slate-800"
        : "border border-border bg-white text-text-main hover:bg-slate-50";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
