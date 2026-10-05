"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Camera, History, Music } from "lucide-react";
import { FOCUS_SEARCH_EVENT } from "@/components/layout/Header";
import { QuickPrecision } from "@/components/search/QuickPrecision";
import { PrecisionSheet, type PrecisionDraft } from "@/components/search/PrecisionSheet";
import { RadarDialog } from "@/components/search/RadarDialog";
import { ResultsView } from "@/components/search/ResultsView";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchMeaning } from "@/components/search/SearchMeaning";
import { SortSheet } from "@/components/search/SortSheet";
import { StickyHuntBar, type ResultView } from "@/components/search/StickyHuntBar";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import { categoryLabel, cityLabel } from "@/data/taxonomy";
import { useHiddenAds } from "@/hooks/useHiddenAds";
import { interpretQuery } from "@/lib/interpret";
import { isOnboarded } from "@/lib/first-run";
import {
  requireAuth,
  takePendingAction,
} from "@/lib/auth";
import { toggleFavoriteStored } from "@/hooks/useFavorites";
import { readRecentHunts, recordRecentHunt, type RecentHunt } from "@/lib/recent-hunts";
import { parsePriceInput } from "@/lib/prices";
import { buildRadarConfig, type RadarConfig } from "@/lib/radar";
import { runSearch, sortResults, type SortKey } from "@/lib/search";
import {
  buildEffectiveContext,
  EMPTY_CONTEXT_BASE,
  type ContextBase,
} from "@/lib/search-context";
import { formatPriceToman } from "@/lib/prices";
import type { FixtureAd } from "@/data/search-fixtures";
import type {
  Interpretation,
  MatchResult,
  SearchContext,
  SearchOutcome,
} from "@/types/search";

type Phase = "idle" | "loading" | "ready" | "empty" | "error";

const EXAMPLES = [
  { label: "پیانو U3 تهران", query: "پیانو U3 تهران", icon: Music },
  { label: "آپارتمان نوساز سعادت‌آباد", query: "آپارتمان نوساز سعادت‌آباد", icon: Building2 },
  { label: "دوربین سونی زیر ۱۰۰م", query: "دوربین سونی زیر ۱۰۰ میلیون", icon: Camera },
];
const VIEW_STORAGE_KEY = "shakar:result-view:v1";

function readParams(params: URLSearchParams): { query: string; base: ContextBase } {
  return {
    query: params.get("q") ?? "",
    base: {
      category: params.get("cat") ?? "all",
      city: params.get("city") ?? "all",
      priceMin: params.get("min") ?? "",
      priceMax: params.get("max") ?? "",
      include: params.getAll("inc"),
      exclude: params.getAll("exc"),
      hasImage: params.get("img") === "1",
    },
  };
}

function writeParams(query: string, base: ContextBase): string {
  const params = new URLSearchParams();
  if (query.trim() !== "") params.set("q", query.trim());
  for (const term of base.include) params.append("inc", term);
  for (const term of base.exclude) params.append("exc", term);
  if (base.category !== "all") params.set("cat", base.category);
  if (base.city !== "all") params.set("city", base.city);
  if (base.priceMin.trim() !== "") params.set("min", base.priceMin.trim());
  if (base.priceMax.trim() !== "") params.set("max", base.priceMax.trim());
  if (base.hasImage) params.set("img", "1");
  const serialized = params.toString();
  return serialized === "" ? "/" : `/?${serialized}`;
}

function readStoredView(): ResultView {
  if (typeof window === "undefined") return "card";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "compact" ? "compact" : "card";
  } catch {
    return "card";
  }
}

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
 * Shared by results-mode (which reruns) and setup-mode (which does not).
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
 * The data comes from our own sessionStorage; this just guards corruption.
 */
function isContextBaseLike(value: unknown): value is ContextBase {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ContextBase).include) &&
    Array.isArray((value as ContextBase).exclude)
  );
}

export function SearchWorkspace() {
  const router = useRouter();  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [base, setBase] = useState<ContextBase>(EMPTY_CONTEXT_BASE);
  const [interpretation, setInterpretation] = useState<Interpretation>({ applied: [], preferences: [] });
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [effective, setEffective] = useState<SearchContext | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [sort, setSort] = useState<SortKey>("best");
  const [view, setView] = useState<ResultView>(readStoredView);
  const [radar, setRadar] = useState<RadarConfig | null>(null);
  const [radarOpen, setRadarOpen] = useState(false);
  const { hiddenIds, hide, unhide } = useHiddenAds();
  const [recentHunts, setRecentHunts] = useState<RecentHunt[]>(() => readRecentHunts());

  const inputRef = useRef<HTMLInputElement>(null);
  const advancedRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const submittedQuery = useRef("");

  /** Setup mode: no paid search has fired yet in this session. */
  const isSetup = phase === "idle";

  /** Live, free interpretation of the typed query — setup only, never paid. */
  const liveInterp = useMemo(() => {
    const t = query.trim();
    return t === "" ? null : interpretQuery(t);
  }, [query]);

  /**
   * One intent display for both modes. Setup shows the live query's
   * interpretation; results show the submitted one. Same logic, same chips —
   * so what the user curates in setup is exactly what gets searched.
   */
  const activeInterp = isSetup ? liveInterp : interpretation;
  const hasIntent = isSetup ? query.trim() !== "" : submittedQuery.current !== "";

  const execute = useCallback(
    (ctx: SearchContext, prefs: string[]) => {
      setPhase("loading");
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        try {
          const result = runSearch(ctx, SEARCH_FIXTURES, prefs);
          setOutcome(result);
          setEffective(ctx);
          setPhase(result.results.length === 0 ? "empty" : "ready");
        } catch {
          setPhase("error");
        }
      }, 600);
    },
    []
  );


  /**
   * The single paid-search event. Every hunt — setup fire, deep link,
   * recent-hunt rerun — funnels through here, and every firing is recorded
   * in the honest local history.
   */
  const firePaidSearch = useCallback(
    (trimmed: string, nextBase: ContextBase, nextDismissed: ReadonlySet<string>) => {
      const interp = interpretQuery(trimmed);
      const ctx = buildEffectiveContext(trimmed, nextBase, interp, nextDismissed);
      setInterpretation(interp);
      setDismissed(nextDismissed);
      setRecentHunts(recordRecentHunt(trimmed, nextBase));
      submittedQuery.current = trimmed;
      router.replace(writeParams(trimmed, nextBase), { scroll: false });
      execute(
        ctx,
        interp.preferences.map((p) => p.value).filter((v) => !ctx.includeKeywords.includes(v))
      );
    },
    [execute, router]
  );

  const submit = useCallback(
    (rawQuery: string, nextBase: ContextBase, keepDismissed: boolean) => {
      const trimmed = rawQuery.trim();
      if (trimmed === "") return;
      const nextDismissed =
        keepDismissed && submittedQuery.current === trimmed ? dismissed : new Set<string>();
      firePaidSearch(trimmed, nextBase, nextDismissed);
    },
    [dismissed, firePaidSearch]
  );

  /**
   * Hunt Setup → the ONE paid search. The user curated intent (query,
   * dismissals, base) in setup; all of it is preserved, never reset.
   * This is the only paid-search trigger reachable from setup.
   */
  function fireHunt(draftBase: ContextBase) {
    const trimmed = query.trim();
    if (trimmed === "") return;
    setBase(draftBase);
    firePaidSearch(trimmed, draftBase, dismissed);
  }

  // Deep-link / back-navigation: restore context from the URL once.
  // First-launch gate runs before anything else.
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
    } else if (pending?.type === "radar") {
      const rq = pending.query.trim();
      if (rq !== "") {
        const rbase = isContextBaseLike(pending.base) ? pending.base : EMPTY_CONTEXT_BASE;
        setQuery(rq);
        setBase(rbase);
        // The radar is the hunt definition — no paid search needed to arm it.
        const interp = interpretQuery(rq);
        const ctx = buildEffectiveContext(rq, rbase, interp, new Set());
        setRadar(buildRadarConfig(ctx, rq));
        setRadarOpen(true);
        return;
      }
    }
    const { query: q, base: b } = readParams(searchParams);
    if (q.trim() === "") return;
    setQuery(q);
    setBase(b);
    submit(q, b, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function focusQuery() {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    }
    window.addEventListener(FOCUS_SEARCH_EVENT, focusQuery);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusQuery);
  }, []);

  const rerun = useCallback(
    (nextBase: ContextBase, nextDismissed: ReadonlySet<string>) => {
      if (submittedQuery.current === "") return;
      const ctx = buildEffectiveContext(submittedQuery.current, nextBase, interpretation, nextDismissed);
      router.replace(writeParams(submittedQuery.current, nextBase), { scroll: false });
      execute(
        ctx,
        interpretation.preferences.map((p) => p.value).filter((v) => !ctx.includeKeywords.includes(v))
      );
    },
    [execute, interpretation, router]
  );

  function removeRefinement(id: string) {
    const { nextBase, nextDismissed } = applyRefinementRemoval(id, base, dismissed);
    setBase(nextBase);
    setDismissed(nextDismissed);
    rerun(nextBase, nextDismissed);
  }

  /**
   * Setup-mode removal: curates intent without firing anything.
   * No paid search happens in setup.
   */
  function setupRemoveRefinement(id: string) {
    const { nextBase, nextDismissed } = applyRefinementRemoval(id, base, dismissed);
    setBase(nextBase);
    setDismissed(nextDismissed);
  }

  /** Confirm an inferred reading as an explicit refinement. */
  function promoteInferred(id: string) {
    const nextBase = applyInferredPromotion(id, base);
    if (!nextBase) return;
    setBase(nextBase);
    rerun(nextBase, dismissed);
  }

  /** Setup-mode promotion: confirms intent without firing anything. */
  function setupPromoteInferred(id: string) {
    const nextBase = applyInferredPromotion(id, base);
    if (!nextBase) return;
    setBase(nextBase);
  }

  /** Setup-mode preference promotion: no paid search. */
  function setupPromotePreference(id: string) {
    const pref = liveInterp?.preferences.find((p) => p.id === id);
    if (!pref || base.include.includes(pref.value)) return;
    setBase({ ...base, include: [...base.include, pref.value] });
  }

  const groups = useMemo(() => {
    if (!hasIntent || !activeInterp) return [];
    return buildDisplayGroups(base, activeInterp, dismissed);
  }, [base, activeInterp, dismissed, hasIntent]);

  /** Meaning shows only inferred readings — explicit refinements live in the summary. */
  const inferredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          rows: group.chips
            .filter((chip) => chip.inferred)
            .map((chip) => ({ id: chip.id, label: chip.label.replace(/^حذف:\s*/, "") })),
        }))
        .filter((group) => group.rows.length > 0),
    [groups]
  );

  // Synchronous mirror of the executed context, for the active-search summary.
  const summaryChips = useMemo(() => groups.flatMap((g) => g.chips), [groups]);

  const visiblePreferences = (activeInterp?.preferences ?? []).filter(
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

  const adsById = useMemo(() => new Map(SEARCH_FIXTURES.map((ad) => [ad.id, ad])), []);
  const readyResults = useMemo(() => {
    const list = outcome?.results ?? [];
    const out: Array<{ ad: FixtureAd; match: MatchResult }> = [];
    for (const match of list) {
      const ad = adsById.get(match.adId);
      if (ad) out.push({ ad, match });
    }
    return sortResults(out, sort);
  }, [outcome, adsById, sort]);

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
   * Refine mode: the user knows this is a NEW paid search —
   * the sheet CTA reads «اجرای مجدد شکار».
   */
  function handleSheetApply(draft: PrecisionDraft) {
    const nextBase = draftToBase(draft);
    setBase(nextBase);
    setSheetOpen(false);
    advancedRef.current?.focus();
    rerun(nextBase, dismissed);
  }

  /**
   * Setup mode: the draft becomes the hunt, then the ONE paid search fires.
   * The sheet CTA reads «شکار کن».
   */
  function handleSetupApply(draft: PrecisionDraft) {
    const nextBase = draftToBase(draft);
    setSheetOpen(false);
    fireHunt(nextBase);
  }

  /** Suggested hunt: fill the intent, open setup for user confirmation. Never auto-fires. */
  function applySuggestedHunt(exampleQuery: string) {
    setQuery(exampleQuery);
    setSheetOpen(true);
  }

  /** Recent hunt: the user's own confirmed intent — deliberate re-run. */
  function rerunRecentHunt(hunt: RecentHunt) {
    setQuery(hunt.query);
    setBase(hunt.base);
    setDismissed(new Set<string>());
    firePaidSearch(hunt.query, hunt.base, new Set<string>());
  }

  /**
   * Search input submit. In setup, Enter reviews intent in the sheet —
   * it never fires a paid search directly. In results, Enter starts an
   * explicit new hunt.
   */
  function handleInputSubmit() {
    if (query.trim() === "") return;
    if (isSetup) {
      setSheetOpen(true);
    } else {
      submit(query, base, true);
    }
  }

  function handleSheetClose() {
    setSheetOpen(false);
    advancedRef.current?.focus();
  }

  function handleViewChange(next: ResultView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function handleOpenRadar() {
    const q = (effective?.query ?? query).trim();
    if (q === "") return;
    // کمین is a persistent action: guests are routed to auth with the
    // exact hunt stored for resume.
    if (!requireAuth({ type: "radar", query: q, base }, (url) => router.push(url)))
      return;
    const ctx =
      effective ?? buildEffectiveContext(q, base, liveInterp ?? interpretQuery(q), dismissed);
    setRadar(buildRadarConfig(ctx, q));
    setRadarOpen(true);
  }

  const advancedActive =
    base.priceMin.trim() !== "" ||
    base.priceMax.trim() !== "" ||
    base.include.length > 0 ||
    base.exclude.length > 0 ||
    base.hasImage;

  const hasSubmitted = submittedQuery.current !== "";
  const showResults = phase !== "idle" && effective !== null;

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onSubmit={handleInputSubmit}
        isSearching={phase === "loading"}
      />

      {isSetup && (
        <div className="flex flex-col gap-5">
          {query.trim() === "" ? (
            <>
              {recentHunts.length > 0 && (
                <section aria-label="شکارهای اخیر" className="flex flex-col gap-2">
                  <p className="text-xs leading-5 text-muted-foreground">شکارهای اخیر</p>
                  <ul className="flex flex-col gap-1.5">
                    {recentHunts.map((hunt) => (
                      <li key={`${hunt.ts}:${hunt.query}`}>
                        <button
                          type="button"
                          onClick={() => rerunRecentHunt(hunt)}
                          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-start text-[13px] text-foreground transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <History
                            size={15}
                            aria-hidden="true"
                            className="shrink-0 text-muted-foreground"
                          />
                          <span className="min-w-0 flex-1 truncate">{hunt.query}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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
            </>
          ) : (
            <>
              <SearchMeaning
                groups={inferredGroups}
                preferences={visiblePreferences.map((p) => ({ id: p.id, label: p.display }))}
                onDismissRow={setupRemoveRefinement}
                onPromoteRow={setupPromoteInferred}
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
            </>
          )}
        </div>
      )}

      {hasSubmitted && phase !== "idle" && (
        <SearchMeaning
          groups={inferredGroups}
          preferences={visiblePreferences.map((p) => ({ id: p.id, label: p.display }))}
          onDismissRow={(rowId) => removeRefinement(rowId)}
          onPromoteRow={(rowId) => promoteInferred(rowId)}
          onPromotePreference={(id) => {
            const pref = interpretation.preferences.find((p) => p.id === id);
            if (!pref || base.include.includes(pref.value)) return;
            const nextBase = { ...base, include: [...base.include, pref.value] };
            setBase(nextBase);
            rerun(nextBase, dismissed);
          }}
        />
      )}

      {showResults && (
        <StickyHuntBar
          query={submittedQuery.current}
          resultCount={outcome?.results.length ?? 0}
          refinementCount={summaryChips.length}
          sort={sort}
          onOpenSort={() => setSortSheetOpen(true)}
          view={view}
          onViewChange={handleViewChange}
          onOpenPrecision={() => setSheetOpen(true)}
          onBackToSearch={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            inputRef.current?.focus({ preventScroll: true });
          }}
        />
      )}

      {showResults && effective && (
        <ResultsView
          phase={phase === "loading" ? "loading" : phase === "error" ? "error" : outcome && outcome.results.length === 0 ? "empty" : "ready"}
          results={readyResults}
          suppressedCount={outcome?.suppressed.length ?? 0}
          includeTerms={effective.includeKeywords}
          excludeTerms={effective.excludeKeywords}
          view={view}
          hiddenIds={hiddenIds}
          onHide={hide}
          onUnhide={unhide}
          onOpenRadar={handleOpenRadar}
          onOpenPrecision={() => setSheetOpen(true)}
          onRetry={() => {
            if (submittedQuery.current === "") return;
            const ctx = buildEffectiveContext(submittedQuery.current, base, interpretation, dismissed);
            execute(
              ctx,
              interpretation.preferences.map((p) => p.value).filter((v) => !ctx.includeKeywords.includes(v))
            );
          }}
        />
      )}

      <PrecisionSheet
        key={sheetOpen ? "open" : "closed"}
        open={sheetOpen}
        mode={isSetup ? "setup" : "refine"}
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
        onApply={isSetup ? handleSetupApply : handleSheetApply}
        onClose={handleSheetClose}
        onOpenRadar={handleOpenRadar}
      />

      <SortSheet
        open={sortSheetOpen}
        sort={sort}
        onSelect={setSort}
        onClose={() => setSortSheetOpen(false)}
      />

      <RadarDialog open={radarOpen} radar={radar} onClose={() => setRadarOpen(false)} />
    </div>
  );
}
