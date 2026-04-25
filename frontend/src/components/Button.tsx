import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "blue" | "green" | "ghost" | "danger";
  children: ReactNode;
};

const variants = {
  primary: "bg-swiss text-white shadow-[0_14px_28px_rgba(220,0,24,.22)]",
  blue: "bg-alpine text-white shadow-[0_14px_28px_rgba(36,91,127,.2)]",
  green: "bg-pine text-white shadow-[0_14px_28px_rgba(31,138,76,.2)]",
  ghost: "border border-slate-200 bg-white/60 text-slate-800",
  danger: "bg-red-700 text-white"
};

export default function Button({ className = "", variant = "blue", children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
