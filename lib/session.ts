"use client";

import { useSyncExternalStore } from "react";
import { api, ApiError, ensureCsrfCookie, NetworkError } from "@/lib/api";
import { mapUser, type ApiUser } from "@/lib/api-mappers";
import { SESSION_HINT_COOKIE, roleKey, type SessionUser } from "@/lib/users";

/**
 * Who is signed in.
 *
 * The real session is Laravel's httpOnly cookie, checked by the API on every request.
 * This module keeps the signed-in user for the UI (filled in by sign-in and by the
 * CRM store when GET /api/crm returns) and a small hint cookie that proxy.ts reads to
 * redirect early. If the API ever answers 401, the app clears both and goes to /login.
 */

let current: SessionUser | null = null;
const listeners = new Set<() => void>();
const signedOutListeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * remember: true/false at sign-in ("Keep me signed in"); null on later page loads,
 * which reuses the choice made at sign-in.
 */
function writeHint(user: SessionUser, remember: boolean | null) {
  if (remember !== null) localStorageSet("nexora_remember", remember ? "1" : "0");
  const long = remember ?? localStorageGet("nexora_remember") === "1";
  document.cookie = `${SESSION_HINT_COOKIE}=${roleKey(user.role)}; path=/; samesite=lax${long ? `; max-age=${60 * 60 * 24 * 30}` : ""}`;
}

function localStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the hint cookie just won't be long-lived.
  }
}

/** Sets the signed-in user (from sign-in or from GET /api/crm). */
export function setSessionUser(user: SessionUser, remember: boolean | null = null) {
  current = user;
  writeHint(user, remember);
  emit();
}

/** Forgets the user locally (after sign-out or when the API says the session ended). */
export function clearSession() {
  current = null;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  emit();
  signedOutListeners.forEach((cb) => cb());
}

/** Lets the CRM store drop its data when the user signs out. */
export function onSignedOut(cb: () => void) {
  signedOutListeners.add(cb);
  return () => {
    signedOutListeners.delete(cb);
  };
}

/** The signed-in user, or null before the data has loaded / when signed out. */
export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}

export type SignInResult = { ok: true; user: SessionUser } | { ok: false; error: string };

export async function signIn(email: string, password: string, remember: boolean): Promise<SignInResult> {
  if (!email.trim() || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  try {
    await ensureCsrfCookie(true);
    const res = await api.post<{ data: ApiUser }>("/login", { email: email.trim(), password, remember });
    const user = mapUser(res.data);
    setSessionUser(user, remember);
    return { ok: true, user };
  } catch (err) {
    if (err instanceof ApiError) {
      // 422: wrong email/password or locked out. Laravel puts the message on "email".
      return { ok: false, error: err.field("email") ?? err.field("password") ?? err.message };
    }
    if (err instanceof NetworkError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't sign in. Try again." };
  }
}

export async function signOut() {
  try {
    await api.post("/logout");
  } catch {
    // Already signed out on the server, or offline: sign out locally either way.
  }
  clearSession();
}
