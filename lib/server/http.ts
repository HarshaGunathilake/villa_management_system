import { NextResponse } from "next/server";
import { ensureReady } from "./db";

/** An error with an HTTP status and a short machine-readable code the client can react to. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, "bad_request", message);
export const notFound = (what = "Record") => new ApiError(404, "not_found", `${what} not found.`);

/**
 * Wraps a route handler: makes sure the database is ready, blocks requests
 * coming from other websites, and turns errors into tidy JSON.
 */
export function route(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      if (request.method !== "GET") assertSameOrigin(request);
      await ensureReady();
      const result = await handler(request);
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ ok: false, code: error.code, error: error.message, ...error.extra }, { status: error.status });
      }
      console.error("[api]", error);
      const code = (error as { code?: string })?.code;
      const dbDown = code === "ECONNREFUSED" || code === "ER_ACCESS_DENIED_ERROR" || code === "ER_BAD_DB_ERROR" || code === "ENOTFOUND";
      return NextResponse.json(
        {
          ok: false,
          code: dbDown ? "database_unavailable" : "server_error",
          error: dbDown ? "The database could not be reached. Check that MySQL is running and the DB_ settings in .env.local." : "Something went wrong on the server.",
        },
        { status: dbDown ? 503 : 500 },
      );
    }
  };
}

/** Changes are only accepted from pages of this app, as JSON. Stops other sites acting through a signed-in browser. */
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new ApiError(403, "forbidden", "Request not allowed from this origin.");
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    throw new ApiError(415, "bad_request", "Send JSON.");
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw badRequest("The request could not be read.");
}

/* ------------------------------------------------------------------ input checks */

export function text(value: unknown, label: string, opts: { max?: number; min?: number; optional?: boolean } = {}): string {
  const { max = 255, min = 0, optional = false } = opts;
  if (value === undefined || value === null || value === "") {
    if (optional || min === 0) return "";
    throw badRequest(`${label} is required.`);
  }
  if (typeof value !== "string") throw badRequest(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`${label} is too short.`);
  if (trimmed.length > max) throw badRequest(`${label} is too long.`);
  return trimmed;
}

export function integer(value: unknown, label: string, opts: { min?: number; max?: number } = {}): number {
  const { min = 0, max = 2_000_000_000 } = opts;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || Math.round(n) !== n) throw badRequest(`${label} must be a whole number.`);
  if (n < min || n > max) throw badRequest(`${label} is out of range.`);
  return n;
}

export function isoDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw badRequest(`${label} must be a date.`);
  }
  return value;
}

export function clockTime(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw badRequest(`${label} must be a time.`);
  return value;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw badRequest(`${label} is not valid.`);
  return value as T;
}

export function recordId(value: unknown, label = "Id"): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(value)) throw badRequest(`${label} is not valid.`);
  return value;
}

export function email(value: unknown, label = "Email"): string {
  const v = text(value, label, { min: 3, max: 190 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest(`${label} does not look right.`);
  return v;
}

export function password(value: unknown, label = "Password"): string {
  if (typeof value !== "string" || value.length < 8) throw badRequest(`${label} must be at least 8 characters.`);
  if (value.length > 200) throw badRequest(`${label} is too long.`);
  return value;
}
