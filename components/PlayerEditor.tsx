"use client";

import { useEffect, useState } from "react";
import { Button, Rating } from "@/components/ui";
import {
  RATING_DEFAULT,
  RATING_MAX,
  RATING_MIN,
  type SportConfig,
  computeOverall,
  defaultRatings,
} from "@/lib/sports";
import type { RosterEntry } from "@/app/actions";

export type EditorTarget =
  { mode: "new" } | { mode: "edit"; player: RosterEntry };

export default function PlayerEditor({
  config,
  target,
  onClose,
  onSave,
  onDelete,
  busy,
}: {
  config: SportConfig;
  target: EditorTarget;
  onClose: () => void;
  onSave: (input: {
    playerId?: string;
    name: string;
    position: string;
    ratings: Record<string, number>;
  }) => void;
  onDelete?: (playerId: string) => void;
  busy: boolean;
}) {
  const existing = target.mode === "edit" ? target.player : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [position, setPosition] = useState(
    existing?.position ?? config.positions[0].key,
  );
  const [ratings, setRatings] = useState<Record<string, number>>(
    existing?.ratings ?? defaultRatings(config),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const overall = computeOverall(config, ratings);

  // Mirrors the sliders when they all agree, so the quick control shows the
  // real value instead of snapping back to a default.
  const values = config.attributes.map((a) => ratings[a.key] ?? RATING_DEFAULT);
  const allEqual = values.every((v) => v === values[0]);
  const quickValue = allEqual ? values[0] : overall;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-8 shadow-[var(--shadow-lift)] sm:max-w-2xl sm:rounded-3xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={existing ? `Edit ${existing.name}` : "Add player"}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {existing ? existing.name : "Add player"}
            </h2>
            <p className="text-sm text-muted">{config.label} ratings</p>
          </div>
          <div className="flex flex-col items-center">
            <Rating value={overall} />
            <span className="mt-1 text-[10px] uppercase tracking-wider text-muted">
              Overall
            </span>
          </div>
        </div>

        <div className="sm:grid sm:grid-cols-2 sm:gap-x-7">
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who is it?"
              autoFocus={!existing}
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>

          <fieldset className="mt-5">
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
              Position
            </legend>
            <div className="flex gap-2">
              {config.positions.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPosition(p.key)}
                  aria-pressed={position === p.key}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm transition ${
                    position === p.key
                      ? "border-accent-line bg-accent-wash font-semibold text-accent-strong"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:text-foreground"
                  }`}
                >
                  {p.full}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-6 rounded-2xl border border-accent-line bg-accent-wash/60 p-4">
          <div className="flex items-baseline justify-between">
            <label htmlFor="quick-rate" className="text-sm font-medium">
              Set everything at once
            </label>
            <span className="font-mono text-sm tabular-nums text-muted">
              {quickValue}
            </span>
          </div>
          <input
            id="quick-rate"
            type="range"
            min={RATING_MIN}
            max={RATING_MAX}
            value={quickValue}
            style={{
              ["--fill" as string]: `${((quickValue - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100}%`,
            }}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRatings(
                Object.fromEntries(config.attributes.map((a) => [a.key, next])),
              );
            }}
            className="mt-1.5"
          />
          <p className="mt-0.5 text-xs text-muted">
            Rough them in with one drag, then fine-tune below only where it
            matters.
          </p>
        </div>

        <div className="mt-5 space-y-5 sm:grid sm:grid-cols-2 sm:gap-x-7 sm:gap-y-5 sm:space-y-0">
          {config.attributes.map((attr) => {
            const value = ratings[attr.key] ?? 70;
            const fill =
              ((value - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100;
            return (
              <div key={attr.key}>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor={`attr-${attr.key}`}
                    className="text-sm font-medium"
                  >
                    {attr.label}
                  </label>
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {value}
                  </span>
                </div>
                <input
                  id={`attr-${attr.key}`}
                  type="range"
                  min={RATING_MIN}
                  max={RATING_MAX}
                  value={value}
                  style={{ ["--fill" as string]: `${fill}%` }}
                  onChange={(e) =>
                    setRatings((prev) => ({
                      ...prev,
                      [attr.key]: Number(e.target.value),
                    }))
                  }
                  className="mt-1"
                />
                <p className="mt-0.5 text-xs text-muted">{attr.hint}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({ playerId: existing?.id, name, position, ratings })
            }
            disabled={!name.trim() || busy}
            className="flex-[2]"
          >
            {busy ? "Saving…" : existing ? "Save changes" : "Add to roster"}
          </Button>
        </div>

        {existing && onDelete && (
          <div className="mt-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5">
                <span className="flex-1 pl-1 text-sm text-rose-700">
                  Remove {existing.name} from {config.label.toLowerCase()}?
                </span>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onDelete(existing.id)}
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 text-sm text-muted transition hover:text-rose-600"
              >
                Remove from roster
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
