// Small fetch helper used by the screens to talk to the /api routes.

export interface SupportContact {
  email: string;
  phone: string;
  platformName: string;
}

/** Sent when access went off because the card subscription ended: what paying again costs. */
export interface Renewal {
  monthlyAmount: number;
  /** Card payments are set up on the server */
  canPay: boolean;
  /** The villa signed up itself and has not paid yet (rather than a subscription that ended) */
  firstPayment?: boolean;
}

export type ApiFailure = { ok: false; status: number; code: string; error: string; support?: SupportContact; renewal?: Renewal; email?: string };
export type ApiResponse<T> = ({ ok: true; status: number } & T) | ApiFailure;

export async function api<T = object>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.ok && json?.ok) return { ...(json as T), ok: true, status: response.status };
    return {
      ok: false,
      status: response.status,
      code: String(json?.code ?? "server_error"),
      error: String(json?.error ?? "Something went wrong. Please try again."),
      support: json?.support as SupportContact | undefined,
      renewal: json?.renewal as Renewal | undefined,
      email: typeof json?.email === "string" ? json.email : undefined,
    };
  } catch {
    return { ok: false, status: 0, code: "network", error: "Could not reach the server. Check your connection and try again." };
  }
}
