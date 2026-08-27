"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unlockEditing } from "@/app/actions";
import { Button } from "@/components/ui";

export default function PasscodeGate({
  onUnlocked,
  onClose,
}: {
  onUnlocked: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (!code.trim() || pending) return;
    startTransition(async () => {
      const ok = await unlockEditing(code);
      if (ok) {
        onUnlocked();
      } else {
        setFailed(true);
        setCode("");
        input.current?.focus();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm rounded-t-3xl border border-line bg-surface p-5 pb-8 shadow-[var(--shadow-lift)] sm:rounded-3xl sm:p-6"
        aria-label="Enter the editing passcode"
      >
        <h2 className="text-lg font-semibold">Passcode needed</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Anyone can view the roster and make teams. Changing ratings takes the
          shared code.
        </p>

        <input
          ref={input}
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setFailed(false);
          }}
          placeholder="Passcode"
          autoComplete="off"
          className={`mt-4 w-full rounded-xl border bg-surface px-4 py-3 text-base tracking-widest outline-none placeholder:tracking-normal placeholder:text-muted/60 focus:ring-2 focus:ring-accent/15 ${
            failed
              ? "border-rose-300 focus:border-rose-400"
              : "border-line focus:border-accent"
          }`}
        />

        <p
          aria-live="polite"
          className={`mt-1.5 h-4 text-xs ${failed ? "text-rose-600" : "text-transparent"}`}
        >
          {failed ? "That's not it. Try again." : "placeholder"}
        </p>

        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!code.trim() || pending}
            className="flex-[2]"
          >
            {pending ? "Checking…" : "Unlock editing"}
          </Button>
        </div>
      </form>
    </div>
  );
}
