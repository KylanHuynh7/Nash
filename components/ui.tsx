import type { ReactNode } from "react";

/** Colour-codes an overall rating so the roster scans quickly. */
export function ratingTone(overall: number): string {
  if (overall >= 88) return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  if (overall >= 78) return "text-lime-300 border-lime-500/40 bg-lime-500/10";
  if (overall >= 68) return "text-amber-300 border-amber-500/40 bg-amber-500/10";
  if (overall >= 58) return "text-orange-300 border-orange-500/40 bg-orange-500/10";
  return "text-neutral-300 border-neutral-600/50 bg-neutral-500/10";
}

export function Rating({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-mono font-semibold tabular-nums ${ratingTone(
        value,
      )} ${size === "sm" ? "min-w-8 px-1.5 py-0.5 text-xs" : "min-w-10 px-2 py-1 text-sm"}`}
    >
      {value}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-accent text-black font-semibold hover:brightness-110 active:brightness-95",
    ghost: "border border-line bg-surface text-foreground hover:border-neutral-600 active:bg-raised",
    danger: "border border-red-900/70 bg-red-950/40 text-red-300 hover:bg-red-950/70",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
