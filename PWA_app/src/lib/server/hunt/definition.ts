import "server-only";

import type { HuntDefinition } from "./pipeline";
import {
  detectCategoryFromText,
  detectServiceIntent,
  detectRoleMode,
  interpretQuery,
  DEMAND_VERBS,
  KNOWN_CITIES,
  PREFERENCE_CUES,
  NEGATION_VERBS,
  EXCLUDE_PREFIXES,
  PRICE_STRUCTURAL_WORDS,
  ROLE_WORDS,
} from "@/lib/interpret";
import type { RoleMode } from "@/lib/interpret";
import { normalizeForMatch, stemToken, tokenize, AFFIX_ONLY } from "@/lib/persianNormalize";
import { buildContract } from "./contract";
import type { InterpretedConstraint } from "@/types/search";

/**
 * Validates an incoming hunt/kamin definition. Shared by POST /api/hunts
 * and the kamin APIs — one choke point, so a kamin can never watch a
 * meaning the hunt pipeline couldn't run. Null = 400 garbage.
 */
export function toHuntDefinition(body: unknown): HuntDefinition | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const query = str(b.query).trim();
  if (query === "") return null;
  const transaction = b.transaction === "rent" || b.transaction === "buy" ? b.transaction : "";
  const condition =
    b.condition === "new" || b.condition === "used" || b.condition === "any"
      ? b.condition
      : "";
  // R8 (P3): the kamin replay path (kamins/[id]/run) rebuilds the definition
  // through THIS choke point from the stored (fully resolved) definition.
  // These semantic fields must survive the round-trip — dropping them made
  // every scheduled hunt run degraded (بدون-X became exact-capable, service
  // hunts lost demand-goods/target binding, role direction reverted).
  // resolveHuntDefinition recomputes them fresh for live hunts, so passing
  // validated values through is safe in both directions.
  const ROLE_MODES: readonly string[] = [
    "seek-buyer",
    "seek-seller",
    "self-buyer",
    "self-seller",
    "none",
  ];
  const roleMode: RoleMode =
    typeof b.roleMode === "string" && (ROLE_MODES as readonly string[]).includes(b.roleMode)
      ? (b.roleMode as RoleMode)
      : "none";
  return {
    query,
    include: strArr(b.include),
    exclude: strArr(b.exclude),
    should: [],
    city: str(b.city) || "all",
    category: str(b.category) || "all",
    priceMin: str(b.priceMin),
    priceMax: str(b.priceMax),
    transaction,
    condition,
    deepHistory: b.deepHistory === true,
    serviceIntent: b.serviceIntent === true,
    roleMode,
    absentAttributes: strArr(b.absentAttributes),
  };
}

/**
 * Query resolution — the fix for the «everything matches» incident
 * (2026-10-06: a «پیانو» hunt confirmed pigeons, hay and bicycles).
 *
 * Root cause: the pipeline only matched def.include/def.exclude. The «چی؟»
 * query text — the item the user actually named — was NEVER matched, so a
 * hunt fired with no «باید» chips had include=[] and EVERY ad passed the
 * title/description filters vacuously.
 *
 * resolveHuntDefinition is the single choke point (hunts + kamin arm/run)
 * that turns the raw query into an honest, complete definition:
 *  1. content terms from the query text become MUST (merged into
 *     include) — «پیانو U3 تهران» names پیانو AND U3; matched terms score,
 *     unmatched terms become UNKNOWN (near-miss), never a silent drop
 *     (flaw #19, 2026-10-09);
 *  2. a city named in the text applies when the picker is "all";
 *  3. a category named in the text («آپارتمان» → real-estate) applies when
 *     the picker is "all" — without this the provider scans every category
 *     and the 500-ad window dilutes to ~27 apartments (flaw #10,
 *     2026-10-06: «آپارتمان نوساز سعادت‌آباد» found nothing);
 *  4. price bounds named in the text apply when the fields are empty;
 *  5. inline «نه» excludes apply;
 *  6. nothing the user dismissed (by deterministic constraint id) applies;
 *  7. preference cues («ترجیحاً») become SHOULD — ranking boost only,
 *     never a filter (flaw #19).
 *
 * Structural words (city names, price expressions, cue words, excludes,
 * preference wishes) never become content terms.
 */
export function resolveHuntDefinition(body: unknown): HuntDefinition | null {
  const def = toHuntDefinition(body);
  if (!def) return null;

  const dismissed = getDismissedIds(body);
  const interp = interpretQuery(def.query);
  // A coordinated negative condition is an item attribute, not searchable
  // content: «پیانو تعمیر یا تعویض نشده است» means the piano has no repair/
  // replacement history. Keep the product subject, route both attributes
  // to absence semantics, and never make «تعمیر / یا / است» MUST terms.
  const negatedRepairHistoryQuery =
    /(?:تعمیر|تعمیرات)\s+یا\s+(?:تعمیر|تعمیرات|تعویض)\s+(?:نشده|نشد|ندارد|نکرده|نمی\s?شود)(?:\s+است)?/.test(
      normalizeForMatch(def.query)
    );
  const historyOnlyContent = new Set(["تعمیر", "تعمیرات", "یا", "است"]);
  const isHistoryOnlyTerm = (term: string) =>
    negatedRepairHistoryQuery && historyOnlyContent.has(normalizeForMatch(term));
  // Absence inferences the user dismissed, by normalized value — the
  // contract below must honor the same dismissals the applied list does.
  const dismissedAbsent = new Set(
    interp.applied
      .filter(
        (c) => c.id.startsWith("exclude:absent:") && dismissed.includes(c.id)
      )
      .map((c) => tokenize(c.value).join(" "))
  );
  const applied = interp.applied.filter(
    (c) => c.applied && !dismissed.includes(c.id)
  );

  // 1. Mandatory content terms from the query text — via the intent
  // contract (Decision v2, Experiment B). Token-level parity with the
  // legacy contentTerms stream, with the contract's exact deltas:
  // absence attributes never become content (the R3/B01/B02 inversion),
  // fillers/command words are dropped on record, purpose clauses route
  // to SHOULD. Form-provided include terms still merge first below.
  const contract = buildContract(def.query);
  const absentStems = new Set(
    contract.mustNot.flatMap((t) => tokenize(t.text).map(stemToken))
  );
  // Contract phrases are surface-token strings — split on the space the
  // contract joined with, NEVER tokenize() (it stems). Floor markers
  // («به بالا») are structural, mirroring contentTerms' structural drops.
  const FLOOR_MARKERS = new Set(["به", "بالا"]);
  const phraseTokens = (text: string) =>
    text.split(" ").filter((t) => t !== "" && !FLOOR_MARKERS.has(t));
  const terms = [
    ...(contract.subject ? phraseTokens(contract.subject.text) : []),
    ...contract.must.flatMap((t) => phraseTokens(t.text)),
  ].filter((t) => !absentStems.has(stemToken(t)));
  const seenTerms = new Set<string>();
  for (const t of def.include) for (const s of tokenize(t)) seenTerms.add(s);
  const include = def.include.filter((t) => !isHistoryOnlyTerm(t));
  for (const t of terms) {
    const key = stemToken(t);
    if (!seenTerms.has(key)) {
      include.push(t);
      seenTerms.add(key);
    }
  }

  // 2. City: the query text is the freshest signal. An explicit city word
  // beats a stored/remembered picker value (navid 2026-10-08 — the piano
  // hunt's row SHOWED تهران but the hunt searched تبریز because the
  // remembered picker silently won). A dismissed inference never reaches
  // `applied`, and an explicit picker choice dismisses the inference
  // client-side — so a surviving conflict always resolves to the text.
  const cityC = applied.find((c) => c.kind === "city");
  const city = cityC ? cityC.value : def.city;
  const citySource = cityC ? ("text" as const) : ("picker" as const);

  // 3. Category from text when the picker didn't choose one. Explicit
  // picker wins. An unmapped text category ("personal") falls back to "all"
  // downstream (CATEGORY_API_VALUE ?? "") — fail open, never fail silent.
  const textCategory =
    def.category === "all" || def.category === ""
      ? detectCategoryFromText(def.query)
      : null;
  const category = textCategory ?? def.category;

  // 3b. Transaction from text when the form didn't answer it. The
  // dimension system hides the rent/buy question when the text answers it
  // («آپارتمان بدون وام» ⇒ buy via «وام») — but the fired body carries
  // transaction:"", so the provider would scan both leaves and rentals
  // intrude (R4 h18: «اجاره کوتاه مدت» graded 0 in a بدون‌وام hunt).
  // Text wins when the explicit answer is empty; a dismissed inference
  // never reaches `applied`, so dismissal is honored.
  const txC = applied.find((c) => c.kind === "transaction");
  const txFromText =
    txC?.value === "rent" || txC?.value === "buy" ? txC.value : "";
  const transaction = def.transaction !== "" ? def.transaction : txFromText;

  // 4. Price bounds from text when the fields are empty.
  const minC = applied.find((c) => c.kind === "priceMin");
  const maxC = applied.find((c) => c.kind === "priceMax");
  let priceMin = def.priceMin.trim() === "" && minC ? minC.value : def.priceMin;
  let priceMax = def.priceMax.trim() === "" && maxC ? maxC.value : def.priceMax;
  // Contradictory bounds (min > max) filter out EVERYTHING — fail open
  // instead of guaranteeing an empty hunt.
  const minN = parsePriceBound(priceMin);
  const maxN = parsePriceBound(priceMax);
  if (minN !== null && maxN !== null && minN > maxN) {
    priceMin = "";
    priceMax = "";
  }

  // 4. Inline «نه» excludes from text. Absent-attributes («بدون رنگ»)
  // are partitioned out below — they are conditions, not bans.
  const seenEx = new Set<string>();
  for (const t of def.exclude) seenEx.add(tokenize(t).join(" "));
  const trueExcludes = [...def.exclude];
  for (const c of applied) {
    if (c.kind !== "exclude" || c.id.startsWith("exclude:absent:")) continue;
    const key = tokenize(c.value).join(" ");
    if (key !== "" && !seenEx.has(key)) {
      trueExcludes.push(c.value);
      seenEx.add(key);
    }
  }

  // 4b. Absent-attributes («بدون رنگ» → ["رنگ"]). The query text is the
  // freshest signal: a base exclude colliding with an absent inference
  // resolves to ABSENT semantics — the user confirmed «بدون رنگ» (a
  // desired absence), not a ban on «رنگ». Without this, confirming the
  // form's بدون-chip would resurrect the R3 inversion (murdered inventory).
  // Decision v2: the values now come from the intent contract's clause
  // scanner (multi-clause safe, prefix-free); form-provided attributes
  // still apply, and dismissed inferences stay dismissed.
  const absentAttributes: string[] = [];
  const absentKeys = new Set<string>();
  const pushAbsent = (v: string) => {
    const key = tokenize(v).join(" ");
    if (key !== "" && !absentKeys.has(key)) {
      absentAttributes.push(v);
      absentKeys.add(key);
    }
  };
  for (const t of def.absentAttributes ?? []) pushAbsent(t);
  if (negatedRepairHistoryQuery) pushAbsent("تعمیر");
  for (const t of contract.mustNot) {
    if (dismissedAbsent.has(tokenize(t.text).join(" "))) continue;
    pushAbsent(t.text);
  }
  const exclude = trueExcludes.filter(
    (t) => !absentKeys.has(tokenize(t).join(" "))
  );

  // 5. SHOULD terms from preference cues («ترجیحاً تمیز», flaw #19).
  // Ranking boost only — never filters, never penalizes. Deduped against
  // MUST/NOT terms (stem-compared, like the include merge above).
  const seenShould = new Set<string>();
  for (const t of def.include) for (const s of tokenize(t)) seenShould.add(s);
  for (const t of def.exclude) for (const s of tokenize(t)) seenShould.add(s);
  const should: string[] = [];
  for (const p of interp.preferences) {
    const key = stemToken(p.value);
    if (p.value !== "" && !seenShould.has(key)) {
      should.push(p.value);
      seenShould.add(key);
    }
  }
  // Contract SHOULD additions (purpose clauses — «لپ‌تاپ برای برنامه‌نویسی»).
  for (const t of contract.should) {
    const key = stemToken(t.text);
    if (t.text !== "" && !seenShould.has(key)) {
      should.push(t.text);
      seenShould.add(key);
    }
  }

  // 6. Service intent (P0, HumanTest S3): «تعمیر یخچال» wants a repairer,
  // not a fridge. Computed from the raw query text — never guessed from
  // ad text. The Q4 guard («یخچال تعمیری» = repaired good) lives inside
  // detectServiceIntent.
  const serviceIntent = detectServiceIntent(def.query);

  // 6b. Speech-act role (R7, 2026-10-18): whose ads the hunter wants.
  // Bare «خریدار X» = seek-buyer (navid's R6 product decision) — overrides
  // the direction default downstream when the form didn't answer.
  const roleMode = detectRoleMode(def.query);

  return {
    ...def,
    include,
    exclude,
    absentAttributes,
    should,
    city,
    citySource,
    category,
    priceMin,
    priceMax,
    transaction,
    serviceIntent,
    roleMode,
  };
}

/** Deterministic constraint ids the user dismissed in the form (rare). */
function getDismissedIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const d = (body as Record<string, unknown>).dismissed;
  return Array.isArray(d)
    ? d.filter((x): x is string => typeof x === "string")
    : [];
}

/**
 * Parse a price bound to toman. Digits-only strings («200000000») and
 * Persian digits both work; garbage → null (no bound, never a crash).
 */
export function parsePriceBound(raw: string): number | null {
  const digits = raw.replace(/[^\d۰-۹]/g, "");
  if (digits === "") return null;
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const en = digits.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
  const n = Number(en);
  return Number.isFinite(n) && n > 0 ? n : null;
}
