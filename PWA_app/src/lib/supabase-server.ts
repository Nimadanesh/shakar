/**
 * Minimal server-side Supabase client (PostgREST only, service_role).
 * Server code only — never import from client components. No SDK
 * dependency: a thin typed fetch wrapper is all M2 needs.
 */

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

export interface SupabaseServer {
  readonly url: string;
  rest<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T>;
}

export function supabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function supabaseServer(): SupabaseServer | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const base = `${url.replace(/\/$/, "")}/rest/v1`;

  async function rest<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          apikey: key as string,
          Authorization: `Bearer ${key as string}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          Prefer: "return=representation",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new SupabaseError(
          `Supabase ${method} ${path} → ${res.status}: ${detail.slice(0, 300)}`,
          res.status
        );
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return { url, rest };
}
