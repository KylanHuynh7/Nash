"use client";

import { useMemo, useState } from "react";
import type { RosterEntry } from "@/app/actions";
import { Button, EmptyState, Rating } from "@/components/ui";
import {
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_STEP,
  encodeWeights,
  families,
  isChanged,
  officialWeights,
  playgroundBoard,
  type FamilyWeights,
} from "@/lib/playground";
import { rankLabel } from "@/lib/rank";
import type { SportConfig } from "@/lib/sports";

/**
 * Try out different weights and watch the list re-rank.
 *
 * A sandbox, and it says so in the one place nobody can miss. Nothing here
 * calls a server action: the sliders live in component state and, so a version
 * can be sent to the group chat, in the URL. The official ratings are untouched
 * by anything on this tab.
 */
export default function WeightsPlayground({
  config,
  roster,
  initialWeights,
  onOpen,
}: {
  config: SportConfig;
  roster: RosterEntry[];
  /** From a shared link, already validated server-side. */
  initialWeights: FamilyWeights | null;
  onOpen: (player: RosterEntry) => void;
}) {
  const list = useMemo(() => families(config), [config]);
  const official = useMemo(() => officialWeights(config), [config]);
  const [weights, setWeights] = useState<FamilyWeights>(
    initialWeights ?? official,
  );
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const changed = isChanged(config, weights);
  const board = useMemo(
    () => playgroundBoard(config, roster, weights),
    [config, roster, weights],
  );
  const total = list.reduce((s, f) => s + (weights[f.name] ?? f.weight), 0);

  function update(next: FamilyWeights) {
    setWeights(next);
    setShareState("idle");
    // replaceState, not a navigation: dragging a slider should not stack a
    // history entry per step, and it must not re-run the server page.
    const url = new URL(window.location.href);
    const encoded = encodeWeights(config, next);
    if (encoded) url.searchParams.set("w", encoded);
    else url.searchParams.delete("w");
    window.history.replaceState(null, "", url);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  }

  if (roster.length === 0) {
    return (
      <EmptyState
        title="Nobody to rank yet"
        body="Add players first, then come back to try out weights."
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] lg:sticky lg:top-6">
        <div className="rounded-xl border border-accent-line bg-accent-wash px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground">
            Sandbox: not the official ratings
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Move the weights to see how the list would change. Nothing here is
            saved or changes anyone&apos;s real overall.
          </p>
        </div>

        <ul className="grid gap-3.5">
          {list.map((family) => {
            const value = weights[family.name] ?? family.weight;
            const moved = Math.abs(value - family.weight) > 1e-9;
            const share = total > 0 ? Math.round((value / total) * 100) : 0;
            const id = `weight-${family.slug}`;
            return (
              <li key={family.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label htmlFor={id} className="text-sm font-medium">
                    {family.name}
                  </label>
                  <span className="figure text-xs text-muted">
                    <span className={moved ? "font-semibold text-foreground" : ""}>
                      ×{value.toFixed(2)}
                    </span>{" "}
                    · {share}%
                  </span>
                </div>
                <input
                  id={id}
                  type="range"
                  min={WEIGHT_MIN}
                  max={WEIGHT_MAX}
                  step={WEIGHT_STEP}
                  value={value}
                  // The track's filled half is painted from --fill in
                  // globals.css; without it every slider reads as halfway.
                  style={{
                    ["--fill" as string]: `${((value - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)) * 100}%`,
                  }}
                  onChange={(e) =>
                    update({ ...weights, [family.name]: Number(e.target.value) })
                  }
                />
                {moved && (
                  <p className="mt-0.5 text-[11px] text-muted">
                    Official ×{family.weight.toFixed(2)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            onClick={() => update(official)}
            disabled={!changed}
          >
            Reset
          </Button>
          <Button onClick={share} disabled={!changed}>
            {shareState === "copied"
              ? "Link copied"
              : shareState === "failed"
                ? "Copy the address bar"
                : "Share this version"}
          </Button>
        </div>
      </section>

      <section>
        {board === null ? (
          <EmptyState
            title="Every weight is at zero"
            body="There is nothing to average. Raise at least one weight."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {board.map((row) => (
              <li key={row.player.id}>
                <button
                  onClick={() => onOpen(row.player)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface py-3 pl-3 pr-4 text-left shadow-[var(--shadow-card)] transition hover:border-accent hover:bg-raised active:translate-y-px"
                >
                  <span className="figure w-8 shrink-0 text-center text-xs font-semibold text-muted/70">
                    {rankLabel(row.sandboxRank)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">
                      {row.player.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      Official {rankLabel(row.officialRank)} · {row.official}
                    </span>
                  </span>
                  <Movement moved={row.moved} />
                  <Rating value={row.sandbox} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Places gained or lost against the official list. */
function Movement({ moved }: { moved: number }) {
  if (moved === 0) {
    return (
      <span className="figure w-9 shrink-0 text-right text-xs text-muted/60">
        –
      </span>
    );
  }
  const up = moved > 0;
  return (
    <span
      className={`figure w-9 shrink-0 text-right text-xs font-semibold ${
        up ? "text-emerald-300" : "text-rose-300"
      }`}
      aria-label={`${up ? "up" : "down"} ${Math.abs(moved)}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(moved)}
    </span>
  );
}
