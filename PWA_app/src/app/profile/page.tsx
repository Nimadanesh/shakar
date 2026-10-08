"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, User, X } from "lucide-react";
import { ThemeSwitch } from "@/components/settings/ThemeSwitch";
import { PlanSheet } from "@/components/plan/PlanSheet";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { profileInitials, useProfile } from "@/hooks/useProfile";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { readFavoriteIds } from "@/hooks/useFavorites";
import { readSavedHunts } from "@/lib/saved-hunts";
import { HUNTS_PER_MONTH } from "@/lib/pricing";
import { listKamins } from "@/lib/kamin-store";
import { readHunts } from "@/lib/hunt-store";
import { signOut } from "@/lib/auth";
import { useServerUsage } from "@/lib/usage";

const DATA_KEYS = ["shakar:hunts:v1", "shakar:kamins:v1", "shakar:favorites:v1", "shakar:saved-hunts:v1"];

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function IdentitySection() {
  const { name, saveName, serverBacked } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const initials = profileInitials(name);
  const trimmed = draft.trim();
  const canSave = trimmed !== "" && trimmed !== name.trim();

  function startEdit() {
    setDraft(name);
    setEditing(true);
  }

  function handleSave() {
    if (!canSave) return;
    saveName(trimmed);
    setEditing(false);
  }

  return (
    <SectionCard title="هویت">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
        >
          {initials !== "" ? (
            <span className="text-xl font-semibold leading-7">{initials}</span>
          ) : (
            <User size={26} aria-hidden="true" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[15px] font-semibold leading-6 text-foreground">
            {name.trim() !== "" ? name : "مهمان"}
          </p>
          <p className="text-[12px] leading-5 text-muted-foreground">
            {serverBacked
              ? "نام نمایشی — در همه‌ی دستگاه‌ها یکی است"
              : name.trim() !== ""
                ? "نام نمایشی — در آواتار هم دیده می‌شود"
                : "حساب کاربری هنوز ساخته نشده؛ نام فقط روی همین دستگاه می‌ماند"}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="اسمت چیه؟"
            aria-label="نام نمایشی"
            maxLength={40}
            className="h-11 w-full rounded-lg border border-border bg-secondary/50 px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X size={16} aria-hidden="true" />
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-action-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active disabled:opacity-40"
            >
              <Check size={16} aria-hidden="true" />
              ذخیره
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Pencil size={16} aria-hidden="true" />
          {name.trim() !== "" ? "ویرایش نام" : "ثبت نام"}
        </button>
      )}
    </SectionCard>
  );
}

function PlanSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  // Server first (identical on every device), local history as fallback.
  const serverUsage = useServerUsage();
  // Session-cached: revisits render the known count immediately.
  const { value: hunts } = useHydratedStore("hunts", readHunts);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const localUsed = (hunts ?? []).filter((h) => h.ts >= monthStart).length;
  // Server is the billing truth; local is only a stand-in while loading
  // or when the server can't answer (permissive-dev).
  const usedThisMonth = serverUsage?.usedThisMonth ?? localUsed;
  const quota = serverUsage ? serverUsage.quotaTotal : HUNTS_PER_MONTH;
  const remaining =
    serverUsage?.remaining ?? (quota === null ? null : Math.max(0, quota - usedThisMonth));
  const fa = (n: number) => n.toLocaleString("fa-IR");
  // Guest grants aren't a monthly subscription — only subscribers get the
  // "ماهانه — N شکار" label. Everyone gets true remaining counts.
  const planLabel =
    serverUsage?.kind === "user" && quota !== null
      ? `ماهانه — ${fa(quota)} شکار`
      : "ماهانه — پلن‌ها هنوز نهایی نشده";
  // Kamin quota: "X فعال از Y" for subscribers; guests have no kamin slot.
  const kaminSlots = serverUsage?.kaminSlots ?? null;
  const kaminActive = serverUsage?.kaminActive ?? null;
  const kaminLabel =
    kaminSlots !== null && kaminActive !== null
      ? `${fa(kaminActive)} فعال از ${fa(kaminSlots)}`
      : "—";

  return (
    <SectionCard title="اشتراک">
      <dl className="flex flex-col">
        {[
          ["اشتراک فعلی", planLabel],
          ["شکارهای این ماه", fa(usedThisMonth)],
          ["سهمیه باقی‌مانده", remaining === null ? "—" : fa(remaining)],
          ["کمین‌ها", kaminLabel],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0"
          >
            <dt className="text-[13px] leading-5 text-muted-foreground">{label}</dt>
            <dd className="text-[13px] font-medium tabular-nums leading-5 text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        جزئیات پلن و هزینه‌ها
      </button>
      <PlanSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SectionCard>
  );
}

function DataSection() {
  // Session-cached: revisits render the known counts immediately instead of
  // flashing ۰ → real on every navigation.
  const { value: hunts } = useHydratedStore("hunts", readHunts);
  const { value: kamins } = useHydratedStore("kamins", listKamins);
  const { value: favIds } = useHydratedStore("favorites", readFavoriteIds);
  const { value: saved } = useHydratedStore("saved-hunts", readSavedHunts);
  const counts = {
    kamins: (kamins ?? []).length,
    hunts: (hunts ?? []).length,
    favs: (favIds ?? []).length,
    saved: (saved ?? []).length,
  };
  const [wiped, setWiped] = useState(false);

  function handleWipe() {
    try {
      for (const key of DATA_KEYS) window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setWiped(true);
    // Reload so no stale state survives anywhere (header badge included).
    window.setTimeout(() => window.location.reload(), 1200);
  }

  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <SectionCard title="داده‌های من">
      <p className="text-[13px] leading-6 text-muted-foreground">
        {fa(counts.kamins)} کمین فعال • {fa(counts.favs)} علاقه‌مندی • {fa(counts.hunts)} شکار • {fa(counts.saved)} ذخیره‌شده
      </p>
      <div aria-live="polite">
        {wiped ? (
          <p className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-signal/40 text-sm font-medium text-signal">
            <Check size={16} aria-hidden="true" />
            داده‌ها پاک شد
          </p>
        ) : (
          <ConfirmButton
            label="پاک کردن داده‌های محلی"
            confirmLabel="مطمئنی؟ برای تأیید دوباره بزن"
            onConfirm={handleWipe}
          />
        )}
      </div>
      <p className="text-[12px] leading-5 text-muted-foreground">
        فقط همین دستگاه؛ تم و وضعیت آنبوردینگ می‌ماند.
      </p>
    </SectionCard>
  );
}

/**
 * Account — state-aware.
 *  - Guest: the proactive signup path — what an account protects, one tap
 *    to /auth. No fake "خروج از حساب" for someone who never signed in.
 *  - Logged in: standard logout — the session ends, this device becomes a
 *    guest. The profile (phone number) keeps everything on the server;
 *    kamins keep running there. No "trace" choices anymore (navid 2026-10-08:
 *    the profile IS the phone number, logout is just logout).
 */
function AccountSection({ loggedIn }: { loggedIn: boolean | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  // Unknown yet (hydrating): render the card shell, no fake state.
  if (loggedIn === null) {
    return (
      <SectionCard title="حساب کاربری">
        <div aria-hidden="true" className="h-11 animate-pulse rounded-lg bg-secondary" />
      </SectionCard>
    );
  }

  if (!loggedIn) {
    return (
      <SectionCard title="حساب کاربری">
        <p className="text-[13px] leading-6 text-muted-foreground">
          هنوز حسابی نساخته‌ای. با حساب، کمین‌هات و شکارهات رو همه‌ی دستگاه‌هات داری —
          پشت یه دیوار امن، نه فقط روی همین گوشی.
        </p>
        <button
          type="button"
          onClick={() => router.push("/auth")}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-action-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
        >
          ورود / ساخت حساب
        </button>
        <p className="text-[12px] leading-5 text-muted-foreground">
          با شماره موبایل و یه کد پیامکی — کمتر از یه دقیقه.
        </p>
      </SectionCard>
    );
  }

  async function doSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    // 1. Push cleanup BEFORE the session dies: after logout this device
    //    must not receive the account's kamin notifications (borrowed phone).
    try {
      const reg = await navigator.serviceWorker?.ready;
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
    } catch {
      // best effort — logout proceeds regardless
    }
    // 2. End the session (cookie + local mirror). The device becomes a guest;
    //    the profile's data lives on the server under the phone number.
    await signOut();
    setSignedOut(true);
    window.setTimeout(() => window.location.replace("/"), 900);
  }

  return (
    <SectionCard title="حساب کاربری">
      {signedOut ? (
        <p className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-muted-foreground">
          <Check size={16} aria-hidden="true" />
          خارج شدید — برمی‌گردیم به خانه…
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void doSignOut()}
            disabled={signingOut}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            خروج از حساب
          </button>
          <p className="text-[12px] leading-5 text-muted-foreground">
            کمین‌ها و تاریخچه‌ی حسابت روی سرور می‌مونن؛ با ورود بعدی از هر دستگاهی برمی‌گردن.
          </p>
        </>
      )}
    </SectionCard>
  );
}

/**
 * Profile — account and settings only. Identity is local until backend
 * auth lands; plan numbers are real; nothing is invented.
 */
export default function ProfilePage() {
  const { loggedIn } = useProfile();
  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <IdentitySection />
      <PlanSection />
      <SectionCard title="تنظیمات">
        <ThemeSwitch />
      </SectionCard>
      <DataSection />
      <AccountSection loggedIn={loggedIn} />
    </main>
  );
}
