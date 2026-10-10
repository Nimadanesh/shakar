"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  normalizeLocationSlugs,
  placeLabel,
  provinceLabel,
  provinceOfPlace,
  provincePlaceCounts,
  provinces,
  placesByProvince,
  searchPlaces,
  unclassifiedPlaces,
} from "@/lib/places";
import { cn } from "@/lib/utils";

interface LocationPickerSheetProps {
  open: boolean;
  /** Current selection; [] = all locations (exclusive). Restored on reopen. */
  selected: readonly string[];
  onApply: (cities: string[]) => void;
  onClose: () => void;
}

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-3 text-start text-[14px] transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Hierarchical multi-location picker (province → places) in Shakar's own
 * visual language. All 1,177 catalog places stay reachable: provinces,
 * global search, and an unclassified safety net when data drifts.
 * Single-select OptionSheet is untouched — multi-select has its own
 * explicit contract (checkboxes, sticky summary, اعمال انتخاب).
 */
export function LocationPickerSheet({ open, selected, onApply, onClose }: LocationPickerSheetProps) {
  const [province, setProvince] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(() => normalizeLocationSlugs(selected));

  function reopen() {
    // Fresh draft from the current selection every time the sheet opens —
    // reopening always restores accurately, never merges stale edits.
    setDraft(normalizeLocationSlugs(selected));
    setProvince(null);
    setQuery("");
  }

  function handleClose() {
    onClose();
  }

  const counts = useMemo(() => provincePlaceCounts(), []);
  const unclassified = useMemo(() => unclassifiedPlaces(), []);
  const provincePlaces = useMemo(
    () => (province ? placesByProvince(province) : []),
    [province]
  );

  const searching = query.trim() !== "";
  const searchResults = useMemo(() => {
    if (!searching) return [];
    return searchPlaces(query, undefined, 60).map((p) => ({
      ...p,
      province: provinceOfPlace(p.slug),
    }));
  }, [query, searching]);

  function toggle(slug: string) {
    // Selecting a place always exits the all-locations state (draft []).
    setDraft((d) => (d.includes(slug) ? d.filter((s) => s !== slug) : [...d, slug]));
  }

  function remove(slug: string) {
    setDraft((d) => d.filter((s) => s !== slug));
  }

  function clearAll() {
    setDraft([]);
    setProvince(null);
  }

  const isAll = draft.length === 0;

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      label="انتخاب مکان"
      title={
        province && !searching ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              aria-label="بازگشت به استان‌ها"
              onClick={() => {
                setProvince(null);
                setQuery("");
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <span className="truncate">{provinceLabel(province)}</span>
          </span>
        ) : (
          "انتخاب مکان"
        )
      }
      subtitle={
        province && !searching
          ? `${(counts[province] ?? 0).toLocaleString("fa-IR")} مکان`
          : "یک یا چند شهر را انتخاب کنید"
      }
    >
      <LocationSheetBody
        province={province}
        counts={counts}
        provincePlaces={provincePlaces}
        unclassified={unclassified}
        searching={searching}
        searchResults={searchResults}
        draft={draft}
        isAll={isAll}
        query={query}
        setQuery={setQuery}
        setProvince={setProvince}
        toggle={toggle}
        remove={remove}
        clearAll={clearAll}
        onApply={onApply}
        onClose={handleClose}
        onReopen={reopen}
        open={open}
      />
    </BottomSheet>
  );
}

function LocationSheetBody(props: {
  province: string | null;
  counts: Readonly<Record<string, number>>;
  provincePlaces: Array<{ readonly slug: string; readonly name: string }>;
  unclassified: Array<{ readonly slug: string; readonly name: string }>;
  searching: boolean;
  searchResults: Array<{ slug: string; name: string; province: string | null }>;
  draft: string[];
  isAll: boolean;
  query: string;
  setQuery: (q: string) => void;
  setProvince: (slug: string | null) => void;
  toggle: (slug: string) => void;
  remove: (slug: string) => void;
  clearAll: () => void;
  onApply: (cities: string[]) => void;
  onClose: () => void;
  onReopen: () => void;
  open: boolean;
}) {
  const {
    province,
    counts,
    provincePlaces,
    unclassified,
    searching,
    searchResults,
    draft,
    isAll,
    query,
    setQuery,
    setProvince,
    toggle,
    remove,
    clearAll,
    onApply,
    onClose,
    onReopen,
    open,
  } = props;

  // Restore-on-open without effect-state churn: the parent remounts this
  // sheet per open (key), and the draft initializes from `selected`.
  // This inner effect only fires when `open` flips, syncing a
  // stay-mounted instance (defensive; normally a no-op after remount).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) onReopen();
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-1 bg-card px-1 pb-2 pt-1">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی شهر در همه استان‌ها…"
            aria-label="جستجوی شهر در همه استان‌ها"
            className="min-h-12 w-full rounded-lg border border-border bg-background py-3 pe-4 ps-10 text-base text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
          />
        </div>
      </div>

      {searching ? (
        <div className="flex flex-col gap-1 pb-40" role="listbox" aria-label="نتایج جستجوی مکان">
          {searchResults.map((p) => (
            <PlaceCheckRow
              key={p.slug}
              label={p.name}
              context={p.province ? provinceLabel(p.province) : null}
              checked={draft.includes(p.slug)}
              onToggle={() => toggle(p.slug)}
            />
          ))}
          {searchResults.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              مکانی با این نام پیدا نشد.
            </p>
          )}
        </div>
      ) : province === null ? (
        <div className="flex flex-col gap-1 pb-40" role="listbox" aria-label="استان‌ها">
          <button
            type="button"
            role="option"
            aria-selected={isAll}
            onClick={clearAll}
            className={cn(
              rowClass,
              isAll
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <span className="min-w-0 flex-1 truncate">همه شهرها</span>
            {isAll && <Check size={16} aria-hidden="true" className="shrink-0" />}
          </button>
          {provinces().map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => {
                setProvince(p.slug);
                setQuery("");
              }}
              aria-label={`${p.name}، ${(counts[p.slug] ?? 0).toLocaleString("fa-IR")} مکان`}
              className={cn(
                rowClass,
                "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <span className="min-w-0 flex-1 truncate text-start">{p.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground/80">
                {(counts[p.slug] ?? 0).toLocaleString("fa-IR")}
              </span>
              <ChevronLeft size={16} aria-hidden="true" className="shrink-0" />
            </button>
          ))}
          {unclassified.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
              <p className="px-4 pt-1 text-[12px] text-muted-foreground">سایر مکان‌ها</p>
              {unclassified.map((p) => (
                <PlaceCheckRow
                  key={p.slug}
                  label={p.name}
                  context={null}
                  checked={draft.includes(p.slug)}
                  onToggle={() => toggle(p.slug)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1 pb-40" role="listbox" aria-label={`مکان‌های ${provinceLabel(province)}`}>
          {provincePlaces.map((p) => (
            <PlaceCheckRow
              key={p.slug}
              label={p.name}
              context={null}
              checked={draft.includes(p.slug)}
              onToggle={() => toggle(p.slug)}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 border-t border-border bg-card/95 px-1 pb-1 pt-3 backdrop-blur">
        {draft.length > 0 && (
          <div className="mb-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto" aria-label="مکان‌های انتخاب‌شده">
            {draft.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => remove(slug)}
                aria-label={`حذف ${placeLabel(slug)}`}
                className="flex min-h-8 items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 text-[12px] text-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="max-w-28 truncate">{placeLabel(slug)}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" aria-live="polite">
            {isAll
              ? "همه شهرها"
              : `${draft.length.toLocaleString("fa-IR")} مکان انتخاب شده`}
          </p>
          {!isAll && (
            <button
              type="button"
              onClick={clearAll}
              className="flex min-h-11 shrink-0 items-center rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              پاک کردن
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onApply([...draft]);
              onClose();
            }}
            className="flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-action-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
          >
            اعمال انتخاب{draft.length > 0 ? ` (${draft.length.toLocaleString("fa-IR")})` : ""}
          </button>
        </div>
      </div>
    </>
  );
}

function PlaceCheckRow({
  label,
  context,
  checked,
  onToggle,
}: {
  label: string;
  context: string | null;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        rowClass,
        checked
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors motion-reduce:transition-none",
          checked ? "border-ring bg-secondary text-foreground" : "border-border"
        )}
      >
        {checked && <Check size={14} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-start">{label}</span>
        {context && (
          <span className="block truncate text-start text-[11px] text-muted-foreground/80">
            استان {context}
          </span>
        )}
      </span>
    </button>
  );
}
