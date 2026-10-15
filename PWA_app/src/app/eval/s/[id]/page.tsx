"use client";

import { useCallback, useEffect, useState } from "react";

import { GRADE_OPTIONS, OUTCOME_EASE, OUTCOME_FOUND, type TesterGrade } from "@/lib/eval-copy";

interface MissionSummary {
  id: string;
  query: string;
  taskFa: string;
  maxItems: number;
  response: "draft" | "submitted" | null;
}

interface RunItem {
  listingId: string;
  position: number;
  title: string;
  description: string;
  price: number | null;
  city: string;
  district: string;
}

interface RunResult {
  runId: string;
  mode: string;
  query: string;
  taskFa: string;
  items: RunItem[];
}

type Grade = TesterGrade;

const GRADE_LABELS = GRADE_OPTIONS;

/**
 * Tester mission flow: mission list → run results → per-listing grades →
 * short outcome questions → submit → confirmation → next mission.
 * Plain Persian, no engine internals anywhere in this UI.
 */
export default function EvalSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [active, setActive] = useState<RunResult | null>(null);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState({ found: "", missing: "", noise: "", ease: "" });
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then((p) => setSessionId(p.id)).catch(() => setError("خطا در باز کردن نشست."));
  }, [params]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/eval/session/${sessionId}`, { cache: "no-store" });
    const body = (await res.json()) as { ok: boolean; missions?: MissionSummary[] };
    if (body.ok && body.missions) setMissions(body.missions);
  }, [sessionId]);

  useEffect(() => {
    refresh().catch(() => setError("خطا در دریافت مأموریت‌ها."));
  }, [refresh]);

  async function startRun(missionId: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError("");
    setDone(null);
    try {
      const res = await fetch(`/api/eval/session/${sessionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const body = (await res.json()) as RunResult & { ok: boolean };
      if (!body.ok) throw new Error("run-failed");
      setActive(body);
      setGrades({});
      setReasons({});
      window.scrollTo({ top: 0 });
    } catch {
      setError("اجرای مأموریت ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(final: boolean) {
    if (!sessionId || !active || busy) return;
    const items = active.items.map((it) => ({
      listingId: it.listingId,
      grade: grades[it.listingId] ?? "insufficient",
      reason: reasons[it.listingId] ?? "",
    }));
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/eval/session/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: missions.find((m) => m.query === active.query)?.id,
          runId: active.runId,
          items,
          outcome: {
            foundWhatWasAsked: outcome.found || null,
            missingUseful: outcome.missing || null,
            irrelevantInTheWay: outcome.noise || null,
            ease: outcome.ease || null,
          },
          draft: !final,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "submit-failed");
      if (final) {
        setDone("پاسخ شما ثبت شد. ممنون!");
        setActive(null);
        await refresh();
      } else {
        setDone("پیش‌نویس ذخیره شد؛ می‌توانید بعداً ادامه دهید.");
      }
    } catch {
      setError("ثبت پاسخ ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  if (!sessionId) return <main className="mx-auto max-w-md px-4 py-10">در حال باز کردن…</main>;

  if (active) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <button type="button" onClick={() => setActive(null)} className="text-sm text-neutral-600">
          → بازگشت به مأموریت‌ها
        </button>
        <h1 className="mt-2 text-lg font-bold">جست‌وجو: {active.query}</h1>
        <p className="mt-1 text-sm leading-7">{active.taskFa}</p>
        {active.mode === "replay" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-6">
            این نتایج از قبل آماده شده‌اند (حالت بازپخش) تا قضاوت شما دقیق و قابل تکرار باشد.
          </p>
        )}
        <div className="mt-4 space-y-4">
          {active.items.map((it) => (
            <section key={it.listingId} className="rounded-xl border border-neutral-200 p-4">
              <h2 className="font-medium">{it.title}</h2>
              <p className="mt-1 text-xs text-neutral-500">
                {it.price !== null ? `${it.price.toLocaleString("en")} تومان` : "قیمت نامشخص"}
                {it.city ? ` — ${it.city}` : ""}
                {it.district ? `، ${it.district}` : ""}
              </p>
              {it.description !== "" && (
                <p className="mt-2 text-sm leading-7 text-neutral-700">{it.description}</p>
              )}
              <div className="mt-3 space-y-1">
                {GRADE_LABELS.map((g) => (
                  <label key={String(g.value)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 active:bg-neutral-100">
                    <input
                      type="radio"
                      name={`g-${it.listingId}`}
                      checked={grades[it.listingId] === g.value}
                      onChange={() => setGrades((p) => ({ ...p, [it.listingId]: g.value }))}
                    />
                    <span className="text-sm">{g.fa}</span>
                  </label>
                ))}
              </div>
              <input
                className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="دلیل کوتاه (اختیاری)"
                value={reasons[it.listingId] ?? ""}
                onChange={(e) => setReasons((p) => ({ ...p, [it.listingId]: e.target.value }))}
              />
            </section>
          ))}
        </div>
        <section className="mt-6 rounded-xl border border-neutral-200 p-4">
          <h2 className="font-medium">جمع‌بندی این مأموریت</h2>
          <label className="mt-3 block text-sm">آیا چیزی که مأموریت می‌خواست پیدا شد؟</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={outcome.found} onChange={(e) => setOutcome((p) => ({ ...p, found: e.target.value }))}>
            <option value="">—</option>
            {OUTCOME_FOUND.map((o) => (
              <option key={o.value} value={o.value}>{o.fa}</option>
            ))}
          </select>
          <label className="mt-3 block text-sm">انجام این جست‌وجو چقدر راحت بود؟</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={outcome.ease} onChange={(e) => setOutcome((p) => ({ ...p, ease: e.target.value }))}>
            <option value="">—</option>
            {OUTCOME_EASE.map((o) => (
              <option key={o.value} value={o.value}>{o.fa}</option>
            ))}
          </select>
        </section>
        {error !== "" && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {done !== null && <p className="mt-2 text-sm text-green-700">{done}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy} onClick={() => submit(false)} className="flex-1 rounded-lg border px-4 py-3 disabled:opacity-50">
            ذخیره موقت
          </button>
          <button type="button" disabled={busy} onClick={() => submit(true)} className="flex-1 rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-50">
            ثبت نهایی
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-lg font-bold">مأموریت‌های شما</h1>
      {done !== null && <p className="mt-2 text-sm text-green-700">{done}</p>}
      {error !== "" && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 space-y-3">
        {missions.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={busy}
            onClick={() => startRun(m.id)}
            className="w-full rounded-xl border border-neutral-200 p-4 text-right active:bg-neutral-50"
          >
            <div className="font-medium">جست‌وجو: {m.query}</div>
            <div className="mt-1 text-sm text-neutral-600">{m.taskFa}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {m.response === "submitted" ? "✓ ثبت نهایی شده" : m.response === "draft" ? "پیش‌نویس دارد — ادامه دهید" : "شروع نشده"}
            </div>
          </button>
        ))}
        {missions.length === 0 && <p className="text-sm text-neutral-500">مأموریتی برای شما فعال نیست.</p>}
      </div>
    </main>
  );
}
