"use client";

/**
 * Talks to the Laravel API (backend/). Sign-in uses Laravel Sanctum's SPA mode:
 * the browser keeps an httpOnly session cookie that JavaScript can't read, and every
 * request that changes data sends the CSRF token from the XSRF-TOKEN cookie.
 *
 * The frontend must be opened on the same host name as the API (both "localhost"),
 * otherwise the browser won't share the cookies between them.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** An API request that failed. `errors` holds Laravel's per-field validation messages. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First message for a field, e.g. err.field("email"). */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

/** The server couldn't be reached at all (not running, wrong URL, offline). */
export class NetworkError extends Error {
  constructor() {
    super(`Can't reach the Nexora server at ${API_URL}. Check that it's running and try again.`);
    this.name = "NetworkError";
  }
}

// Called whenever the API says the session is gone (401), so the app can send the user to sign in.
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(cb: () => void) {
  unauthorizedListeners.add(cb);
  return () => {
    unauthorizedListeners.delete(cb);
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// The CSRF cookie request in flight, if any. Callers share it, so two changes started at once
// don't each fetch a token and send one that has already been replaced.
let csrfRequest: Promise<void> | null = null;

/** Asks Laravel for a fresh CSRF cookie (needed before the first change and after it expires). */
export async function ensureCsrfCookie(force = false) {
  if (csrfRequest) return csrfRequest;
  if (!force && readCookie("XSRF-TOKEN")) return;
  csrfRequest = fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "include", headers: { Accept: "application/json" } })
    .then(
      () => undefined,
      () => {
        throw new NetworkError();
      }
    )
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown, retried = false): Promise<T> {
  const changesData = method !== "GET";
  if (changesData) await ensureCsrfCookie();

  const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const xsrf = readCookie("XSRF-TOKEN");
  if (changesData && xsrf) headers["X-XSRF-TOKEN"] = xsrf;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  // 419 = the CSRF token expired. Get a new one and try once more.
  if (res.status === 419 && !retried) {
    await ensureCsrfCookie(true);
    return request<T>(method, path, body, true);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) unauthorizedListeners.forEach((cb) => cb());
    const message =
      (data && typeof data.message === "string" && data.message) ||
      (res.status === 403
        ? "You don't have permission to do that."
        : res.status === 404
          ? "That record no longer exists."
          : res.status === 429
            ? "Too many requests. Wait a minute and try again."
            : "Something went wrong on the server. Try again.");
    throw new ApiError(res.status, message, (data && data.errors) || {});
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

/** A readable message for any error thrown by the api helpers. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  return "Something went wrong. Try again.";
}

/**
 * The server's validation messages (HTTP 422) mapped onto a form's own field names,
 * e.g. formErrors(err, { job_title: "title" }) → { title: "The job title is too long." }.
 * Returns null when the error isn't a validation error or none of its fields are on the form,
 * so the caller can show errorMessage(err) instead.
 */
export function formErrors<F extends string>(err: unknown, fields: Record<string, F>): Partial<Record<F, string>> | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const out: Partial<Record<F, string>> = {};
  for (const [apiField, messages] of Object.entries(err.errors)) {
    const field = fields[apiField];
    if (field && messages[0] && !out[field]) out[field] = messages[0];
  }
  return Object.keys(out).length ? out : null;
}
