"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Camera, Music } from "lucide-react";
import { WhatField } from "@/components/search/WhatField";
import { SpecChips, type InferredChip } from "@/components/search/SpecChips";
import { SpecRow } from "@/components/search/SpecRow";
import { OptionSheet } from "@/components/search/OptionSheet";
import { PriceSheet } from "@/components/search/PriceSheet";
import {
  CATEGORIES,
  CITIES,
  categoryLabel,
  cityLabel,
} from "@/data/taxonomy";
import { interpretQuery } from "@/lib/interpret";
import { isOnboarded } from "@/lib/first-run";
import { takePendingAction } from "@/lib/auth";
import { toggleFavoriteStored } from "@/hooks/useFavorites";
import { recordHunt } from "@/lib/hunt-store";
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
  const [base, setBase] = useState<ContextBase>(EMPTY_CONTEXT_BASE);
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
    const city =
      cityC && base.city === "all"
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
   * asset; the user lands on its canonical triage URL.
   */
  function fireHunt() {
    const trimmed = query.trim();
    if (trimmed === "") return;
    const record = recordHunt(trimmed, base, dismissed);
    if (record) router.push(`/hunt/${record.id}`);
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

  return (
    <div className="flex flex-col gap-4">
      <WhatField ref={inputRef} value={query} onChange={setQuery} />

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
          <SpecChips
            title="حتماً این‌ها باشد"
            hint="اگر این کلمات در توضیحات نباشند، آگهی حذف می‌شود."
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

          <button
            type="button"
            onClick={fireHunt}
            className="mt-1 h-13 min-h-13 rounded-xl bg-action-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
          >
            شکار کن
          </button>
        </div>
      )}

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
        onSelect={(value) => setBase((b) => ({ ...b, city: value }))}
        onClose={() => setCityOpen(false)}
      />
      <PriceSheet
        open={priceOpen}
        priceMin={base.priceMin}
        priceMax={base.priceMax}
        onApply={(min, max) => setBase((b) => ({ ...b, priceMin: min, priceMax: max }))}
        onClose={() => setPriceOpen(false)}
      />
    </div>
  );
}
