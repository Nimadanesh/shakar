"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Camera, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatField } from "@/components/search/WhatField";
import { TypoNudge, TYPO_PAUSE_MS } from "@/components/search/TypoNudge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DimensionChips } from "@/components/search/DimensionChips";
import { LoadingState } from "@/components/ui/LoadingState";
import { RecentHunts } from "@/components/search/RecentHunts";
import { SpecChips, type InferredChip } from "@/components/search/SpecChips";
import { SpecRow } from "@/components/search/SpecRow";
import {
  CATEGORIES,
  CITIES,
  categoryLabel,
  cityLabel,
} from "@/data/taxonomy";
import { interpretQuery } from "@/lib/interpret";
import {
  getDimensionStatuses,
  isDimensionsBlocking,
  type DimensionId,
} from "@/lib/dimensions";
import { recordHunt } from "@/lib/hunt-store";
import { fireRealHunt } from "@/lib/hunt-fire";
import { getRememberedCity, rememberCity } from "@/lib/city-memory";
import { applyTypoFixToText } from "@/lib/persianTypos";
import { isOnboarded } from "@/lib/first-run";
import { takePendingAction } from "@/lib/auth";
import dynamic from "next/dynamic";
import { invalidateUsage, useServerUsage } from "@/lib/usage";
// Closed-by-default sheets: each gets its own chunk — never block first paint.
const PlanSheet = dynamic(
  () => import("@/components/plan/PlanSheet").then((m) => m.PlanSheet),
  { ssr: false }
);
const OptionSheet = dynamic(
  () => import("@/components/search/OptionSheet").then((m) => m.OptionSheet),
  { ssr: false }
);
const PriceSheet = dynamic(
  () => import("@/components/search/PriceSheet").then((m) => m.PriceSheet),
  { ssr: false }
);
import { toggleFavoriteStored } from "@/hooks/useFavorites";
import { parsePriceInput, formatPriceCompact } from "@/lib/prices";
import { EMPTY_CONTEXT_BASE, type ContextBase } from "@/lib/search-context";
import { readParams } from "@/lib/search-params";

const EXAMPLES = [
  { label: "پیانو U3 تهران", query: "پیانو U3 تهران", icon: Music },
  { label: "آپارتمان نوساز سعادت‌آباد", query: "آپارتمان نوساز سعادت‌آباد", icon: Building2 },
  { label: "دوربین سونی زیر ۱۰۰م", query: "دوربین سونی زیر ۱۰۰ میلیون", icon: Camera },
];

interface InferredReadings {
  excludes: InferredChip[];
  city: { id: string; value: string; display: string } | null;
  priceMin: { id: string; value: string; display: string } | null;
  priceMax: { id: string; value: string; display: string } | null;
}

/**
 * Home = the hunt-definition form, and ONLY the form. Three parts:
 * (1) «چی؟» — what is being hunted (a plain field, not a search box);
 * (2) «مشخصات شکار» — include/exclude chips + category/city/price rows;
 * (3) the single «شکار کن» button.
 *
 * Defining the hunt is free. The button consumes one hunt from the
 * subscription quota and lands on the hunt's canonical triage URL.
 * The form never auto-fires, Enter never fires, and home never renders
 * results. History lives in «شکار من», not here.
 */
export function HuntSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  // Pause detection for the typo nudge: it must never interrupt the word
  // being typed — only finished words (or a paused last word) get nudged.
  const settledQuery = useDebouncedValue(query, TYPO_PAUSE_MS);
  // Smart city default: the user's standing preference (remembered from an
  // explicit sheet pick) seeds the form, so the lazy user taps zero times.
  // A city named in the query text still overrides it — flagged as inferred.
  const [base, setBase] = useState<ContextBase>(() => ({
    ...EMPTY_CONTEXT_BASE,
    city: getRememberedCity() ?? "all",
  }));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /** Live, free interpretation of the typed query — setup only, never paid. */
  const liveInterp = useMemo(() => {
    const t = query.trim();
    return t === "" ? null : interpretQuery(t);
  }, [query]);

  const hasIntent = query.trim() !== "";

  /** Inferred readings feed the form's chips/rows, dashed until confirmed. */
  const inferred: InferredReadings = useMemo(() => {
    const empty: InferredReadings = {
      excludes: [],
      city: null,
      priceMin: null,
      priceMax: null,
    };
    if (!liveInterp) return empty;
    const live = (id: string) => !dismissed.has(id);
    const excludes = liveInterp.applied
      .filter((c) => c.kind === "exclude" && live(c.id) && !base.exclude.includes(c.value))
      .map((c) => ({ id: c.id, value: c.value, label: c.display }));
    const cityC = liveInterp.applied.find((c) => c.kind === "city" && live(c.id));
    // A city named in the text is flagged (dashed «حدسی») whenever it
    // differs from the current selection — including a remembered default.
    // The text is the freshest signal, so it wins at fire time unless
    // dismissed; the dashed display is the visible conflict flag.
    const city =
      cityC && cityC.value !== base.city
        ? { id: cityC.id, value: cityC.value, display: cityC.display }
        : null;
    const minC = liveInterp.applied.find((c) => c.kind === "priceMin" && live(c.id));
    const priceMin =
      minC && base.priceMin.trim() === ""
        ? { id: minC.id, value: minC.value, display: minC.display }
        : null;
    const maxC = liveInterp.applied.find((c) => c.kind === "priceMax" && live(c.id));
    const priceMax =
      maxC && base.priceMax.trim() === ""
        ? { id: maxC.id, value: maxC.value, display: maxC.display }
        : null;
    return { excludes, city, priceMin, priceMax };
  }, [liveInterp, dismissed, base]);

  /**
   * THE single hunt event. The curated form becomes a persistent hunt
   * asset; the user lands on its canonical triage URL. `firing` covers
   * the real navigation transition — no artificial delay.
   *
   * A hunt with an unresolved REQUIRED dimension never fires: guessing
   * would waste quota (and for rent/buy, searching both would double the
   * cost). Instead the dimension block flashes — resolving it is one tap,
   * zero quota.
   */
  const [firing, setFiring] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  // Live quota: when the server says remaining === 0, the «شکار کن» button
  // is disabled UP FRONT — the user never walks the whole flow just to be
  // rejected at the end (navid 2026-10-08: quota-exhaustion is a UX killer).
  // undefined (loading) / null (unavailable) → button stays enabled; only a
  // certain zero disables.
  const serverUsage = useServerUsage();
  const quotaExhausted = serverUsage?.remaining === 0;
  const [planOpen, setPlanOpen] = useState(false);
  const dimsSectionRef = useRef<HTMLDivElement | null>(null);
  const [dimsFlash, setDimsFlash] = useState(false);

  /**
   * Required dimensions (registry): visible when the category needs them
   * and no input text already answers them. They stay visible after a
   * chip pick so the user can change their mind; the hunt is blocked
   * while any of them is unresolved.
   */
  const dimStatuses = useMemo(
    () =>
      getDimensionStatuses({
        query: query.trim(),
        include: base.include,
        exclude: base.exclude,
        category: base.category,
        values: { transaction: base.transaction, condition: base.condition },
      }),
    [query, base.include, base.exclude, base.category, base.transaction, base.condition]
  );
  const dimsBlocking = isDimensionsBlocking(dimStatuses);

  function setDimensionValue(id: DimensionId, value: string) {
    setBase((b) =>
      id === "transaction"
        ? { ...b, transaction: value as ContextBase["transaction"] }
        : { ...b, condition: value as ContextBase["condition"] }
    );
  }

  async function fireHunt() {
    const trimmed = query.trim();
    if (trimmed === "" || firing) return;
    if (dimsBlocking) {
      dimsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setDimsFlash(true);
      window.setTimeout(() => setDimsFlash(false), 1400);
      return;
    }
    setFiring(true);
    setQuotaError(null);
    // M4: fire a REAL server hunt via the shared helper. The API returns a
    // run id immediately; the pipeline streams progress over SSE on
    // /hunt/[runId].
    try {
      const result = await fireRealHunt({ query: trimmed, base, dismissed });
      if (!result.ok) {
        if (result.quotaError) setQuotaError(result.quotaError);
        setFiring(false);
        return;
      }
      // The server consumed one quota unit for this firing — record it
      // locally (with the run id, so recents link to the REAL results)
      // so the profile's consumption section reflects reality.
      // (Every firing is a paid event, even if the stream is abandoned.)
      recordHunt(trimmed, base, dismissed, result.runId);
      // Quota changed on the server — drop the shared usage cache so the
      // button state re-reads fresh numbers on the next mount.
      invalidateUsage();
      router.push(`/hunt/${encodeURIComponent(result.runId)}?q=${encodeURIComponent(trimmed)}`);
      return;
    } catch {
      /* fall through to release the button */
    }
    setFiring(false);
  }

  /** One-tap typo fix from the TypoNudge: replace the offending token. */
  function applyTypoFix(originalToken: string, fixed: string) {
    setQuery((q) => applyTypoFixToText(q, originalToken, fixed));
  }

  /** Suggested hunt: fill the WHAT field for review. Never auto-fires. */
  function applySuggestedHunt(exampleQuery: string) {
    setQuery(exampleQuery);
    inputRef.current?.focus({ preventScroll: true });
  }

  function addExplicit(kind: "include" | "exclude", term: string) {
    setBase((b) =>
      kind === "include" && !b.include.includes(term)
        ? { ...b, include: [...b.include, term] }
        : kind === "exclude" && !b.exclude.includes(term)
          ? { ...b, exclude: [...b.exclude, term] }
          : b
    );
  }

  function removeExplicit(kind: "include" | "exclude", term: string) {
    setBase((b) =>
      kind === "include"
        ? { ...b, include: b.include.filter((t) => t !== term) }
        : { ...b, exclude: b.exclude.filter((t) => t !== term) }
    );
  }

  /** Confirm an inferred reading: it becomes explicit. Free — no firing. */
  function confirmInferred(chip: InferredChip | { id: string; value: string }) {
    if (inferred.excludes.some((c) => c.id === chip.id)) {
      addExplicit("exclude", chip.value);
      return;
    }
    if (inferred.city?.id === chip.id) setBase((b) => ({ ...b, city: chip.value }));
    if (inferred.priceMin?.id === chip.id)
      setBase((b) => ({ ...b, priceMin: chip.value }));
    if (inferred.priceMax?.id === chip.id)
      setBase((b) => ({ ...b, priceMax: chip.value }));
  }

  /** Dismiss an inferred reading: it stays out of this hunt. */
  function dismissInferred(id: string) {
    setDismissed((d) => new Set(d).add(id));
  }

  // First-launch gate, auth-resume, and deep-link intent restore.
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    if (!isOnboarded()) {
      router.replace("/onboarding");
      return;
    }
    // Resume an auth-gated action interrupted before login.
    const pending = takePendingAction();
    if (pending?.type === "favorite") {
      toggleFavoriteStored(pending.adId);
    } else if (pending?.type === "radar" && pending.huntId) {
      // Back to the exact hunt page — the user re-taps کمین, now authed.
      router.push(`/hunt/${pending.huntId}`);
      return;
    }
    // Deep link: restore intent for review. Never auto-fire.
    const { query: q, base: b } = readParams(searchParams);
    if (q.trim() === "") return;
    setQuery(q);
    setBase(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const explicitMin = parsePriceInput(base.priceMin);
  const explicitMax = parsePriceInput(base.priceMax);

  const priceRowValue = (() => {
    if (explicitMin !== null && explicitMax !== null)
      return `از ${formatPriceCompact(explicitMin)} تا ${formatPriceCompact(explicitMax)}`;
    if (explicitMax !== null) return `تا ${formatPriceCompact(explicitMax)}`;
    if (explicitMin !== null) return `از ${formatPriceCompact(explicitMin)}`;
    if (inferred.priceMin && inferred.priceMax)
      return `${inferred.priceMin.display} تا ${inferred.priceMax.display}`;
    if (inferred.priceMax) return inferred.priceMax.display;
    if (inferred.priceMin) return inferred.priceMin.display;
    return "همه قیمت‌ها";
  })();
  const priceInferred =
    explicitMin === null && explicitMax === null && (inferred.priceMin !== null || inferred.priceMax !== null);

  /** Inferred readings apply unless dismissed — say so, exactly when one exists. */
  const hasInferred =
    inferred.excludes.length > 0 ||
    inferred.city !== null ||
    inferred.priceMin !== null ||
    inferred.priceMax !== null;

  return (
    <div className="flex flex-col gap-4">
      <WhatField ref={inputRef} value={query} onChange={setQuery} />
      {hasIntent && (
        <TypoNudge
          query={query}
          typingPaused={query === settledQuery}
          onApplyFix={applyTypoFix}
        />
      )}

      {query.trim() === "" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-xs leading-5 text-muted-foreground">شکارهای پیشنهادی</p>
            <div
              className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1"
              style={{
                maskImage:
                  "linear-gradient(to left, black calc(100% - 2rem), transparent)",
                WebkitMaskImage:
                  "linear-gradient(to left, black calc(100% - 2rem), transparent)",
              }}
            >
              {EXAMPLES.map((example) => {
                const Icon = example.icon;
                return (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => applySuggestedHunt(example.query)}
                    className="flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Icon size={15} aria-hidden="true" className="shrink-0" />
                    {example.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none h-24 opacity-100"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
              maskImage:
                "linear-gradient(to bottom, transparent, black 40%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 40%, transparent)",
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SpecChips
            title="حتماً این‌ها باشد"
            hint="کلماتی که در «چی؟» نوشتی خودکار لحاظ می‌شن؛ اینجا فقط فیلترِ اضافه بذار."
            explicit={base.include}
            inferred={[]}
            tone="positive"
            onAdd={(t) => addExplicit("include", t)}
            onRemove={(t) => removeExplicit("include", t)}
            onConfirm={() => {}}
            onDismiss={() => {}}
          />
          <SpecChips
            title="اصلاً این‌ها نباشد"
            hint="اگر این کلمات در توضیحات باشند، آگهی حذف می‌شود."
            explicit={base.exclude}
            inferred={inferred.excludes}
            tone="negative"
            onAdd={(t) => addExplicit("exclude", t)}
            onRemove={(t) => removeExplicit("exclude", t)}
            onConfirm={(id) => {
              const chip = inferred.excludes.find((c) => c.id === id);
              if (chip) confirmInferred(chip);
            }}
            onDismiss={dismissInferred}
          />

          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium leading-5 text-foreground">
              مشخصات شکار
            </p>
            <SpecRow
              label="دسته"
              value={categoryLabel(base.category)}
              onOpen={() => setCategoryOpen(true)}
            />
            <SpecRow
              label="شهر"
              value={inferred.city ? inferred.city.display : cityLabel(base.city)}
              inferred={inferred.city !== null}
              onOpen={() => setCityOpen(true)}
            />
            <SpecRow
              label="قیمت"
              value={priceRowValue}
              inferred={priceInferred}
              onOpen={() => setPriceOpen(true)}
            />
          </div>

          {dimStatuses.length > 0 && (
            <div
              ref={dimsSectionRef}
              className={cn(
                "flex scroll-mt-24 flex-col gap-2 rounded-lg border p-3 transition-colors",
                dimsFlash ? "border-ring" : "border-border"
              )}
            >
              {dimStatuses.map(({ def, value }) => (
                <DimensionChips
                  key={def.id}
                  def={def}
                  value={value}
                  onSelect={(v) => setDimensionValue(def.id, v)}
                />
              ))}
            </div>
          )}

          {hasInferred && (
            <p className="-mt-2 text-xs leading-5 text-muted-foreground">
              موارد «حدسی» هم در شکار اعمال می‌شوند؛ × بزن تا نادیده گرفته شوند.
            </p>
          )}

          <button
            type="button"
            onClick={fireHunt}
            disabled={firing || quotaExhausted}
            aria-disabled={quotaExhausted}
            className="mt-1 flex h-13 min-h-13 items-center justify-center rounded-lg bg-action-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active disabled:cursor-not-allowed disabled:opacity-40"
          >
            {firing ? (
              <LoadingState label="در حال شکار" showElapsed={false} tone="on-primary" />
            ) : quotaExhausted ? (
              "سهمیه‌ات تموم شده"
            ) : (
              "شکار کن"
            )}
          </button>
          {quotaExhausted && (
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border text-[14px] font-medium text-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
            >
              شارژ پلن
            </button>
          )}
          {quotaError !== null && (
            <p role="alert" className="text-center text-[13px] text-destructive">
              {quotaError}
            </p>
          )}
        </div>
      )}

      <RecentHunts />

      <OptionSheet
        open={categoryOpen}
        title="دسته‌بندی"
        options={CATEGORIES}
        selected={base.category}
        onSelect={(value) => setBase((b) => ({ ...b, category: value }))}
        onClose={() => setCategoryOpen(false)}
      />
      <OptionSheet
        open={cityOpen}
        title="شهر"
        options={CITIES}
        selected={base.city}
        onSelect={(value) => {
          setBase((b) => ({ ...b, city: value }));
          // An explicit pick becomes the standing preference for next time…
          rememberCity(value);
          // …and settles the conflict: a hand-picked city dismisses the
          // text's inference for this query (a new query re-infers fresh).
          const inferredId = inferred.city?.id;
          if (inferredId) setDismissed((d) => new Set(d).add(inferredId));
        }}
        onClose={() => setCityOpen(false)}
        searchable
      />

      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
      <PriceSheet
        open={priceOpen}
        priceMin={
          base.priceMin.trim() !== ""
            ? base.priceMin
            : (inferred.priceMin?.value ?? "")
        }
        priceMax={
          base.priceMax.trim() !== ""
            ? base.priceMax
            : (inferred.priceMax?.value ?? "")
        }
        onApply={(min, max) => setBase((b) => ({ ...b, priceMin: min, priceMax: max }))}
        onClose={() => setPriceOpen(false)}
      />
    </div>
  );
}
