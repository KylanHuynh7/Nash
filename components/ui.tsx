import type { ReactNode } from "react";

/**
 * 2K's tier colours: elite green down through yellow to red. On a dark ground
 * the fill has to be a translucent tint of the same hue as the text, or the
 * badge reads as a solid block and drowns the number inside it.
 */
export function ratingTone(overall: number): string {
  if (overall >= 90)
    return "text-emerald-300 border-emerald-400/45 bg-emerald-400/15";
  if (overall >= 80) return "text-lime-300 border-lime-400/45 bg-lime-400/15";
  if (overall >= 72) return "text-amber-300 border-amber-400/45 bg-amber-400/15";
  if (overall >= 66)
    return "text-orange-300 border-orange-400/45 bg-orange-400/15";
  return "text-rose-300 border-rose-400/60/45 bg-rose-400/15";
}

export function Rating({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
}) {
  const scale = {
    sm: "min-w-8 px-1.5 py-0.5 text-xs",
    md: "min-w-11 px-2 py-1 text-[15px]",
    lg: "min-w-14 px-2.5 py-1.5 text-2xl",
  }[size];
  return (
    <span
      className={`figure inline-flex items-center justify-center rounded-lg border font-semibold ${ratingTone(value)} ${scale}`}
    >
      {value}
    </span>
  );
}

/**
 * Solid fill for the same tiers, for bars rather than badges. The badge tint is
 * a 15% wash so the number stays readable on top of it; a bar has nothing on
 * top of it and needs the full colour.
 */
export function ratingBar(overall: number): string {
  if (overall >= 90) return "bg-emerald-400";
  if (overall >= 80) return "bg-lime-400";
  if (overall >= 72) return "bg-amber-400";
  if (overall >= 66) return "bg-orange-400";
  return "bg-rose-400";
}

/**
 * Per-team identity colours — easier to call out than "team one". Home red and
 * away blue first, the way a matchup screen splits two sides.
 */
/*
 * `outline` is written out per team rather than composed, because Tailwind only
 * generates classes it can see as literal strings - an `outline-${colour}-400`
 * silently produces nothing, which is how the mobile wordmark ended up at 16px.
 */
export const TEAM_COLORS = [
  {
    label: "Red",
    dot: "bg-red-500",
    chip: "bg-red-500/15 text-red-300 border-red-400/40",
    ring: "border-red-400/40",
    outline: "outline-red-400/80",
  },
  {
    label: "Blue",
    dot: "bg-sky-400",
    chip: "bg-sky-400/15 text-sky-300 border-sky-400/40",
    ring: "border-sky-400/40",
    outline: "outline-sky-400/80",
  },
  {
    label: "Gold",
    dot: "bg-amber-400",
    chip: "bg-amber-400/15 text-amber-300 border-amber-400/40",
    ring: "border-amber-400/40",
    outline: "outline-amber-400/80",
  },
  {
    label: "Violet",
    dot: "bg-violet-400",
    chip: "bg-violet-400/15 text-violet-300 border-violet-400/40",
    ring: "border-violet-400/40",
    outline: "outline-violet-400/80",
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
      "bg-accent text-white font-semibold shadow-[0_2px_8px_color-mix(in_srgb,var(--accent)_38%,transparent)] hover:bg-accent-strong hover:shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_44%,transparent)] active:translate-y-px",
    ghost:
      "border border-line bg-surface text-foreground shadow-[var(--shadow-card)] hover:border-line-strong hover:bg-sunken active:translate-y-px",
    danger:
      "border border-rose-400/60/40 bg-rose-400/12 text-rose-300 hover:bg-rose-400/20",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:border disabled:border-line-strong disabled:bg-sunken disabled:text-muted disabled:shadow-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface/70 px-5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
        {body}
      </p>
    </div>
  );
}

/**
 * Badge tiers, which are NOT the rating tiers.
 *
 * `ratingTone` runs green-to-red on how good a number is. A badge has already
 * cleared its bar, so there is no bad tier to colour — the scale is rarity, and
 * it reads as metal: bronze, silver, gold, and then something that is not a
 * metal at all because Hall of Fame should not look like "gold, but more".
 *
 * Violet for that top tier rather than a brighter green: the accent is a
 * sport's own colour and a badge is not the sport, so borrowing it would make
 * the rarest badge look like chrome. It also keeps HoF from reading as a 90+
 * rating badge sitting in the wrong place on the card.
 */
export function badgeTone(tier: string | undefined): string {
  switch (tier) {
    case "hof":
      return "text-violet-200 border-violet-400/55 bg-violet-400/20";
    case "gold":
      return "text-yellow-200 border-yellow-400/50 bg-yellow-400/15";
    case "silver":
      return "text-zinc-100 border-zinc-300/45 bg-zinc-300/15";
    case "bronze":
      return "text-amber-200/90 border-amber-600/50 bg-amber-700/25";
    default:
      // Signature and combination badges are untiered on purpose (6i): a shape
      // is not more or less true. Giving them a metal would invent a rank the
      // derivation does not have.
      return "text-foreground border-line-strong bg-raised";
  }
}
