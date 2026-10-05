"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Camera, Music } from "lucide-react";
import { FOCUS_SEARCH_EVENT } from "@/components/layout/Header";
import { QuickPrecision } from "@/components/search/QuickPrecision";
import { PrecisionSheet, type PrecisionDraft } from "@/components/search/PrecisionSheet";
import { HuntInput } from "@/components/search/HuntInput";
import { InterpretationChips } from "@/components/search/InterpretationChips";
import { categoryLabel, cityLabel } from "@/data/taxonomy";
import { interpretQuery } from "@/lib/interpret";
import { isOnboarded } from "@/lib/first-run";
import { takePendingAction } from "@/lib/auth";
import { toggleFavoriteStored } from "@/hooks/useFavorites";
import { recordHunt } from "@/lib/hunt-store";
import { parsePriceInput, formatPriceToman } from "@/lib/prices";
import { huntCostLabel } from "@/lib/pricing";
import {
  EMPTY_CONTEXT_BASE,
  type ContextBase,
} from "@/lib/search-context";
import { readParams } from "@/lib/search-params";
import type { Interpretation } from "@/types/search";

const EXAMPLES = [
  { label: "پیانو U3 تهران", query: "پیانو U3 تهران", icon: Music },
  { label: "آپارتمان نوساز سعادت‌آباد", query: "آپارتمان نوساز سعادت‌آباد", icon: Building2 },
  { label: "دوربین سونی زیر ۱۰۰م", query: "دوربین سونی زیر ۱۰۰ میلیون", icon: Camera },
];

/**
 * Display groups for intent: explicit refinements + inferred readings.
 * Pure: the caller decides which interpretation feeds it (live query in
 * setup, submitted interpretation in results).
 */
function buildDisplayGroups(
  base: ContextBase,
  interpretation: Interpretation,
  dismissed: ReadonlySet<string>
): Array<{
  id: string;
  title: string;
  chips: Array<{ id: string; label: string; inferred?: boolean }>;
}> {
    const result: Array<{
      id: string;
      title: string;
      chips: Array<{ id: string; label: string; inferred?: boolean }>;
    }> = [];
    if (base.include.length > 0) {
      result.push({
        id: "include",
        title: "این کلمات در توضیحات باشد",
        chips: base.include.map((t) => ({ id: `include:${t}`, label: t })),
      });
    }
    const inferredExcludes = interpretation.applied.filter(
      (c) => c.kind === "exclude" && !dismissed.has(c.id)
    );
    if (base.exclude.length > 0 || inferredExcludes.length > 0) {
      result.push({
        id: "exclude",
        title: "این کلمات در توضیحات نباشد",
        chips: [
          ...base.exclude.map((t) => ({ id: `exclude:${t}`, label: t })),
          ...inferredExcludes
            .filter((c) => !base.exclude.includes(c.value))
            .map((c) => ({ id: c.id, label: `حذف: ${c.display}`, inferred: true })),
        ],
      });
    }
    const inferredCity = interpretation.applied.find(
      (c) => c.kind === "city" && !dismissed.has(c.id)
    );
    if (base.city !== "all" || inferredCity) {
      const explicit = base.city !== "all";
      result.push({
        id: "city",
        title: "مکان",
        chips: [
          {
            id: explicit ? `city:${base.city}` : (inferredCity?.id ?? ""),
            label: explicit ? cityLabel(base.city) : (inferredCity?.display ?? ""),
            inferred: !explicit,
          },
        ],
      });
    }
    const priceChips: Array<{ id: string; label: string; inferred?: boolean }> = [];
    const explicitMin = parsePriceInput(base.priceMin);
    const explicitMax = parsePriceInput(base.priceMax);
    if (explicitMin !== null)
      priceChips.push({ id: "priceMin:explicit", label: `از ${formatPriceToman(explicitMin)}` });
    if (explicitMax !== null)
      priceChips.push({ id: "priceMax:explicit", label: `تا ${formatPriceToman(explicitMax)}` });
    for (const c of interpretation.applied) {
      if (dismissed.has(c.id)) continue;
      if (c.kind === "priceMin" && explicitMin === null)
        priceChips.push({ id: c.id, label: c.display, inferred: true });
      if (c.kind === "priceMax" && explicitMax === null)
        priceChips.push({ id: c.id, label: c.display, inferred: true });
    }
    if (priceChips.length > 0) {
      result.push({ id: "price", title: "قیمت", chips: priceChips });
    }
    if (base.category !== "all") {
      result.push({
        id: "category",
        title: "دسته‌بندی",
        chips: [{ id: `category:${base.category}`, label: categoryLabel(base.category) }],
      });
    }
    return result;
}

/**
 * Pure state transition for removing a refinement chip.
 * Setup never fires: curating intent is free.
 */
function applyRefinementRemoval(
  id: string,
  base: ContextBase,
  dismissed: ReadonlySet<string>
): { nextBase: ContextBase; nextDismissed: ReadonlySet<string> } {
  const [kind, ...rest] = id.split(":");
  const value = rest.join(":");
  let nextBase = base;
  let nextDismissed = dismissed;

  if (kind === "include") {
    nextBase = { ...base, include: base.include.filter((t) => t !== value) };
  } else if (kind === "exclude") {
    if (base.exclude.includes(value)) {
      nextBase = { ...base, exclude: base.exclude.filter((t) => t !== value) };
    } else {
      nextDismissed = new Set(dismissed).add(id);
    }
  } else if (kind === "city") {
    if (base.city !== "all") nextBase = { ...base, city: "all" };
    else nextDismissed = new Set(dismissed).add(id);
  } else if (kind === "priceMin") {
    if (base.priceMin.trim() !== "") nextBase = { ...base, priceMin: "" };
    else nextDismissed = new Set(dismissed).add(id);
  } else if (kind === "priceMax") {
    if (base.priceMax.trim() !== "") nextBase = { ...base, priceMax: "" };
    else nextDismissed = new Set(dismissed).add(id);
  } else if (kind === "category") {
    nextBase = { ...base, category: "all" };
  }

  return { nextBase, nextDismissed };
}

/**
 * Pure state transition for confirming an inferred reading.
 * Returns null when there is nothing to promote.
 */
function applyInferredPromotion(id: string, base: ContextBase): ContextBase | null {
  const [kind, ...rest] = id.split(":");
  const value = rest.join(":");
  if (kind === "city" && base.city === "all") return { ...base, city: value };
  if (kind === "priceMin" && base.priceMin.trim() === "") return { ...base, priceMin: value };
  if (kind === "priceMax" && base.priceMax.trim() === "") return { ...base, priceMax: value };
  if (kind === "exclude" && !base.exclude.includes(value))
    return { ...base, exclude: [...base.exclude, value] };
  return null;
}

/**
 * Light structural check for a hunt base restored from storage.
 * The data comes from our own storage; this just guards corruption.
 */
function isContextBaseLike(value: unknown): value is ContextBase {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ContextBase).include) &&
    Array.isArray((value as ContextBase).exclude)
  );
}

/**
 * Home = Hunt Setup, and ONLY setup. It captures intent for free and fires
 * the ONE explicit paid hunt, landing on the hunt's canonical triage URL.
 * It never renders results and never fires implicitly — not even for
 * deep links. History lives in «شکار من», not here.
 */
export function HuntSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [base, setBase] = useState<ContextBase>(EMPTY_CONTEXT_BASE);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const advancedRef = useRef<HTMLButtonElement>(null);

  /** Live, free interpretation of the typed query — setup only, never paid. */
  const liveInterp = useMemo(() => {
    const t = query.trim();
    return t === "" ? null : interpretQuery(t);
  }, [query]);

  const hasIntent = query.trim() !== "";

  /**
   * THE single paid-hunt event. The curated intent becomes a persistent
   * hunt asset; the user lands on its canonical triage URL.
   */
  function fireHunt(draftBase: ContextBase) {
    const trimmed = query.trim();
    if (trimmed === "") return;
    const record = recordHunt(trimmed, draftBase, dismissed);
    setBase(draftBase);
    if (record) router.push(`/hunt/${record.id}`);
  }

  function draftToBase(draft: PrecisionDraft): ContextBase {
    return {
      ...base,
      priceMin: draft.priceMin.trim(),
      priceMax: draft.priceMax.trim(),
      include: draft.include,
      exclude: draft.exclude,
      hasImage: draft.hasImage,
      category: draft.category,
      city: draft.city,
    };
  }

  /**
   * Setup mode: the draft becomes the hunt, then the ONE paid hunt fires.
   * The sheet CTA reads «شکار کن».
   */
  function handleSetupApply(draft: PrecisionDraft) {
    const nextBase = draftToBase(draft);
    setSheetOpen(false);
    fireHunt(nextBase);
  }

  /** Suggested hunt: fill the intent for review. Never auto-fires. */
  function applySuggestedHunt(exampleQuery: string) {
    setQuery(exampleQuery);
    inputRef.current?.focus({ preventScroll: true });
  }

  /**
   * Enter fires the hunt — it is the primary action. The sheet never opens
   * automatically; «شکار دقیق» is opt-in advanced.
   */
  function handleInputSubmit() {
    if (query.trim() === "") return;
    fireHunt(base);
  }

  function handleSheetClose() {
    setSheetOpen(false);
    advancedRef.current?.focus();
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

  useEffect(() => {
    function focusQuery() {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    }
    window.addEventListener(FOCUS_SEARCH_EVENT, focusQuery);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusQuery);
  }, []);

  /** Setup-mode removal: curates intent without firing anything. */
  function setupRemoveRefinement(id: string) {
    const { nextBase, nextDismissed } = applyRefinementRemoval(id, base, dismissed);
    setBase(nextBase);
    setDismissed(nextDismissed);
  }

  /** Setup-mode promotion: confirms intent without firing anything. */
  function setupPromoteInferred(id: string) {
    const nextBase = applyInferredPromotion(id, base);
    if (!nextBase) return;
    setBase(nextBase);
  }

  /** Setup-mode preference promotion: no paid hunt. */
  function setupPromotePreference(id: string) {
    const pref = liveInterp?.preferences.find((p) => p.id === id);
    if (!pref || base.include.includes(pref.value)) return;
    setBase({ ...base, include: [...base.include, pref.value] });
  }

  const groups = useMemo(() => {
    if (!hasIntent || !liveInterp) return [];
    return buildDisplayGroups(base, liveInterp, dismissed);
  }, [base, liveInterp, dismissed, hasIntent]);

  // Synchronous mirror of the curated intent, for the precision affordance.
  const summaryChips = useMemo(() => groups.flatMap((g) => g.chips), [groups]);

  const visiblePreferences = (liveInterp?.preferences ?? []).filter(
    (p) => hasIntent && !base.include.includes(p.value)
  );

  /** Compact price summary for the setup affordance row. */
  const priceAffordanceLabel = useMemo(() => {
    const min = parsePriceInput(base.priceMin);
    const max = parsePriceInput(base.priceMax);
    if (min !== null && max !== null)
      return `قیمت: ${formatPriceToman(min)} تا ${formatPriceToman(max)}`;
    if (max !== null) return `قیمت: تا ${formatPriceToman(max)}`;
    if (min !== null) return `قیمت: از ${formatPriceToman(min)}`;
    return "قیمت: همه";
  }, [base.priceMin, base.priceMax]);

  const advancedActive =
    base.priceMin.trim() !== "" ||
    base.priceMax.trim() !== "" ||
    base.include.length > 0 ||
    base.exclude.length > 0 ||
    base.hasImage;

  return (
    <div className="flex flex-col gap-4">
      <HuntInput
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onSubmit={handleInputSubmit}
        isSearching={false}
      />

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
                    className="flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl border border-border bg-card px-4 text-[13px] text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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
          <InterpretationChips
            groups={groups}
            preferences={visiblePreferences.map((p) => ({ id: p.id, label: p.display }))}
            onRemoveChip={setupRemoveRefinement}
            onPromoteChip={setupPromoteInferred}
            onPromotePreference={setupPromotePreference}
          />
          <div className="flex flex-wrap gap-2" aria-label="دسته‌بندی، شهر و محدوده قیمت">
            {[
              `دسته: ${categoryLabel(base.category)}`,
              `شهر: ${cityLabel(base.city)}`,
              priceAffordanceLabel,
            ].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label}
              </button>
            ))}
          </div>
          <QuickPrecision
            ref={advancedRef}
            label="شکار دقیق"
            onOpenAdvanced={() => setSheetOpen(true)}
            advancedActive={advancedActive}
            refinementCount={summaryChips.length}
          />
          {/* Pre-flight confirm state + the ONE paid trigger. No numbers. */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
            <p className="text-[13px] leading-6 text-muted-foreground">
              با این مشخصات شکار کنم؟
            </p>
            <button
              type="button"
              onClick={() => fireHunt(base)}
              className="h-12 rounded-xl bg-action-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
            >
              شکار کن
            </button>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              {huntCostLabel()}
            </p>
          </div>
        </div>
      )}

      <PrecisionSheet
        key={sheetOpen ? "open" : "closed"}
        open={sheetOpen}
        mode="setup"
        initial={{
          priceMin: base.priceMin,
          priceMax: base.priceMax,
          include: base.include,
          exclude: base.exclude,
          hasImage: base.hasImage,
          category: base.category,
          city: base.city,
        }}
        preview={{ query, category: base.category, city: base.city }}
        onApply={handleSetupApply}
        onClose={handleSheetClose}
      />

    </div>
  );
}
