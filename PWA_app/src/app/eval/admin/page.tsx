"use client";

import { useState } from "react";

/**
 * Private admin console (Persian). Bearer token is typed by the operator
 * and kept in memory only — never persisted, never logged.
 */
export default function EvalAdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<string>("");
  const [error, setError] = useState("");
  const [mint, setMint] = useState<string>("");
  const [cohort, setCohort] = useState("pilot-1");

  function headers(): HeadersInit {
    return { Authorization: `Bearer ${token.trim()}`, "Content-Type": "application/json" };
  }

  async function call(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetch(path, { ...(init ?? {}), headers: { ...headers(), ...init?.headers } });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `http-${res.status}`);
    return body;
  }

  async function loadStats() {
    setError("");
    try {
      const body = (await call("/api/eval/admin/stats")) as { ok: boolean };
      if (body.ok) {
        setAuthed(true);
        setStats(JSON.stringify(body, null, 2));
      }
    } catch {
      setError("دسترسی نامعتبر است یا سرویس پیکربندی نشده.");
    }
  }

  async function downloadExport(format: "json" | "csv") {
    setError("");
    try {
      const res = await fetch(`/api/eval/admin/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (!res.ok) throw new Error("export-failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = format === "csv" ? "shakar-eval-export.csv" : "shakar-eval-export.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      setError("دانلود خروجی ناموفق بود.");
    }
  }
  async function mintInvitation() {
    setError("");
    setMint("");
    try {
      const body = (await call("/api/eval/admin/invitations", {
        method: "POST",
        body: JSON.stringify({ cohort }),
      })) as { ok: boolean; code?: string };
      if (body.ok && body.code) setMint(body.code);
    } catch {
      setError("ساخت کد دعوت ناموفق بود.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6" dir="rtl">
      <h1 className="text-lg font-bold">مدیریت ارزیابی (خصوصی)</h1>
      {!authed && (
        <div className="mt-4">
          <label className="block text-sm" htmlFor="admin-token">کلید مدیریت</label>
          <input
            id="admin-token"
            dir="ltr"
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-3 text-left"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <button type="button" onClick={loadStats} className="mt-3 rounded-lg bg-neutral-900 px-4 py-3 text-white">
            ورود و مشاهده آمار
          </button>
          {error !== "" && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
      {authed && (
        <div className="mt-4 space-y-4">
          <section className="rounded-xl border p-4">
            <h2 className="font-medium">ساخت کد دعوت</h2>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-lg border px-3 py-2"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                placeholder="نام گروه"
              />
              <button type="button" onClick={mintInvitation} className="rounded-lg bg-neutral-900 px-4 py-2 text-white">
                ساخت
              </button>
            </div>
            {mint !== "" && (
              <p className="mt-2 break-all rounded bg-neutral-100 p-2 text-sm" dir="ltr">{mint}</p>
            )}
          </section>
          <section className="rounded-xl border p-4">
            <h2 className="font-medium">آمار</h2>
            <button type="button" onClick={loadStats} className="mt-2 rounded-lg border px-4 py-2">
              به‌روزرسانی
            </button>
            <pre className="mt-2 overflow-auto rounded bg-neutral-100 p-2 text-xs" dir="ltr">{stats}</pre>
          </section>
          <section className="rounded-xl border p-4">
            <h2 className="font-medium">خروجی پاسخ‌ها</h2>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => downloadExport("json")} className="rounded-lg border px-4 py-2 text-sm">
                دانلود JSON
              </button>
              <button type="button" onClick={() => downloadExport("csv")} className="rounded-lg border px-4 py-2 text-sm">
                دانلود CSV
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
