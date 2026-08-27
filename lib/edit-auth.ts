import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "rib_edit";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * The cookie holds a hash of the passcode rather than the passcode itself, so
 * a stolen cookie reveals nothing and a forged one can't be produced without
 * knowing the code.
 */
function tokenFor(passcode: string): string {
  return createHash("sha256").update(`run-it-back:v1:${passcode}`).digest("hex");
}

function expectedToken(): string | null {
  const passcode = process.env.EDIT_PASSCODE?.trim();
  return passcode ? tokenFor(passcode) : null;
}

function matches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, and length alone leaks nothing
  // here since both sides are fixed-width hashes.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True when no passcode is configured — the app stays open by default. */
export function editingIsGated(): boolean {
  return expectedToken() !== null;
}

export async function canEdit(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return true;
  const jar = await cookies();
  const held = jar.get(COOKIE)?.value;
  return typeof held === "string" && matches(held, expected);
}

/** Throws rather than returning, so a caller can't forget to check. */
export async function assertCanEdit(): Promise<void> {
  if (!(await canEdit())) {
    throw new Error("Editing is locked. Enter the passcode to make changes.");
  }
}

export async function grantEditing(passcode: string): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return true;

  // A brief pause makes guessing a short code tedious without being noticeable
  // to someone typing the right one.
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (!matches(tokenFor(passcode.trim()), expected)) return false;

  const jar = await cookies();
  jar.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return true;
}

export async function revokeEditing(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
