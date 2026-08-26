import type { ReactNode } from "react";

/**
 * Ratings run neutral at the middle of the group and diverge from there, so a
 * roster scans as "who's above and below average" rather than a wall of colour.
 */
export function ratingTone(overall: number): string {
  if (overall >= 88) return "text-emerald-700 border-emerald-200 bg-emerald-50";
  if (overall >= 78) return "text-teal-700 border-teal-200 bg-teal-50";
  if (overall >= 68) return "text-slate-600 border-slate-200 bg-slate-100";
  if (overall >= 58) return "text-amber-700 border-amber-200 bg-amber-50";
  return "text-rose-700 border-rose-200 bg-rose-50";
}

export function Rating({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) {
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

/** Per-team identity colours — easier to call out than "team one". */
export const TEAM_COLORS = [
  {
    label: "Indigo",
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    ring: "border-indigo-200",
  },
  {
    label: "Teal",
    dot: "bg-teal-500",
    chip: "bg-teal-50 text-teal-700 border-teal-200",
    ring: "border-teal-200",
  },
  {
    label: "Rose",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    ring: "border-rose-200",
  },
  {
    label: "Amber",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    ring: "border-amber-200",
  },
] as const;

export function teamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
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
    primary:
      "bg-accent text-white font-semibold shadow-sm hover:bg-accent-strong active:translate-y-px",
    ghost:
      "border border-line bg-surface text-foreground shadow-sm hover:border-line-strong hover:bg-sunken active:translate-y-px",
    danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
        {body}
      </p>
    </div>
  );
}
