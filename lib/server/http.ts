import { NextResponse } from "next/server";
import { config } from "./config";
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
export function route(handler: (request: Request) => Promise<unknown>, opts: { fromWebsite?: boolean; fileUpload?: boolean } = {}) {
  return async (request: Request) => {
    // The public website's forms (Contact us, the waitlist) post here from its own domain.
    const cors = opts.fromWebsite ? websiteCors(request) : {};
    try {
      if (request.method !== "GET") assertSameOrigin(request, !!opts.fromWebsite, !!opts.fileUpload);
      await ensureReady();
      const result = await handler(request);
      // A handler may answer with its own response, for example a redirect to a file.
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store", ...cors } });
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ ok: false, code: error.code, error: error.message, ...error.extra }, { status: error.status, headers: cors });
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

const websiteOrigin = () => (config.siteUrl ? new URL(config.siteUrl).origin : null);

/** Lets the public website's own address call a route (and nothing else). */
function websiteCors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin && origin === websiteOrigin() ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : { Vary: "Origin" };
}

/** The browser's check before the website posts a form: only the website's address is allowed. */
export function websitePreflight(request: Request) {
  const cors = websiteCors(request);
  if (!cors["Access-Control-Allow-Origin"]) return new Response(null, { status: 403, headers: cors });
  return new Response(null, {
    status: 204,
    headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" },
  });
}

/**
 * Changes are only accepted from pages of this app, as JSON. Stops other sites acting through a signed-in browser.
 * A route open to the website also accepts the website's own address (it carries no sign-in).
 */
function assertSameOrigin(request: Request, fromWebsite = false, fileUpload = false) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const allowed = fromWebsite && origin !== null && origin === websiteOrigin();
  if (origin && host && new URL(origin).host !== host && !allowed) throw new ApiError(403, "forbidden", "Request not allowed from this origin.");
  // A file comes as a form, which other sites could also send: so it must say it comes from this app's own address.
  if (fileUpload) {
    if (!origin || !host || new URL(origin).host !== host) throw new ApiError(403, "forbidden", "Request not allowed from this origin.");
    if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) throw new ApiError(415, "bad_request", "Send the file as a form.");
    return;
  }
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
