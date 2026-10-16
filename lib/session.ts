"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "@/types";
import {
  DEMO_PASSWORD,
  ROLES_COOKIE,
  SESSION_COOKIE,
  findUserByEmail,
  findUserById,
  parseRoleOverrides,
  withRole,
  type DemoUser,
} from "@/lib/users";

/**
 * Frontend-only session: the signed-in user's id lives in a cookie so that
 * proxy.ts can protect routes on the server. This is a stand-in until the
 * backend issues a signed, httpOnly session cookie after checking a hashed
 * password. Keep all session reads behind these functions so that swap is
 * a change in one file.
 */

const listeners = new Set<() => void>();

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// useSyncExternalStore needs the same object back while nothing changed.
let cacheKey = "";
let cacheUser: DemoUser | null = null;

function getSnapshot(): DemoUser | null {
  const id = readCookie(SESSION_COOKIE);
  const roles = readCookie(ROLES_COOKIE) ?? "";
  const key = `${id}|${roles}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cacheUser = withRole(findUserById(id), parseRoleOverrides(roles));
  }
  return cacheUser;
}

/** Role of any demo user, including changes made on the Team page. */
export function getRoleOverrides(): Record<string, Role> {
  return parseRoleOverrides(readCookie(ROLES_COOKIE));
}

/** Saves a role change so the sidebar, pages and proxy.ts all use it. */
export function setRoleOverride(userId: string, role: Role) {
  const next = { ...getRoleOverrides(), [userId]: role };
  const original = findUserById(userId)?.role;
  if (original === role) delete next[userId];
  document.cookie = `${ROLES_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; samesite=lax; max-age=${60 * 60 * 24 * 365}`;
  emit();
}

export function clearRoleOverrides() {
  document.cookie = `${ROLES_COOKIE}=; path=/; max-age=0; samesite=lax`;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((cb) => cb());
}

/** The signed-in user, or null before hydration / when signed out. */
export function useSessionUser(): DemoUser | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export type SignInResult = { ok: true; user: DemoUser } | { ok: false; error: string };

const attempts = { count: 0 };
export const MAX_ATTEMPTS = 5;

export async function signIn(email: string, password: string, remember: boolean): Promise<SignInResult> {
  // Simulate the network round trip so the loading state is visible.
  await new Promise((r) => setTimeout(r, 600));

  if (!email.trim() || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  if (attempts.count >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Reload the page and try again in 15 minutes." };
  }
  const user = findUserByEmail(email);
  if (!user || password !== DEMO_PASSWORD) {
    attempts.count += 1;
    const left = Math.max(0, MAX_ATTEMPTS - attempts.count);
    return {
      ok: false,
      error:
        left > 0
          ? `Email or password is incorrect. ${left} more ${left === 1 ? "try" : "tries"} before a 15-minute lock.`
          : "Too many attempts. Try again in 15 minutes.",
    };
  }

  attempts.count = 0;
  const maxAge = remember ? `; max-age=${60 * 60 * 24 * 30}` : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(user.id)}; path=/; samesite=lax${maxAge}`;
  emit();
  return { ok: true, user: withRole(user, getRoleOverrides()) ?? user };
}

export function signOut() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  emit();
}
