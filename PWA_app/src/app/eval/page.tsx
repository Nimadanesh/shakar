"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Private evaluation entry: invitation code + consent notice.
 * No product UI, no hunt UI — only the evaluation doorway.
 */
export default function EvalEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    if (busy || code.trim() === "") return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/eval/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = (await res.json()) as { ok: boolean; sessionId?: string; error?: string };
      if (body.ok && body.sessionId) {
        router.push(`/eval/s/${body.sessionId}`);
      } else {
        setError("کد دعوت معتبر نیست. لطفاً دوباره بررسی کنید.");
      }
    } catch {
      setError("خطای ارتباط. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold">ارزیابی کیفیت جست‌وجو</h1>
      <p className="mt-3 text-sm leading-7">
        شما به یک برنامه ارزیابی خصوصی دعوت شده‌اید. کد دعوت خود را وارد
        کنید. هیچ نام یا اطلاعات تماسی از شما گرفته نمی‌شود؛ پاسخ‌ها
        ناشناس ذخیره می‌شوند و فقط برای بهبود کیفیت جست‌وجو استفاده خواهند شد.
      </p>
      <label className="mt-6 block text-sm font-medium" htmlFor="eval-code">
        کد دعوت
      </label>
      <input
        id="eval-code"
        dir="ltr"
        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-3 text-left"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ev_…"
        autoComplete="off"
      />
      {error !== "" && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={join}
        className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-50"
      >
        {busy ? "در حال بررسی…" : "شروع ارزیابی"}
      </button>
    </main>
  );
}
