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
  ].filter((t) => !absentStems.has(stemToken(t)) && !isHistoryOnlyTerm(t));
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
    if (
      c.kind !== "exclude" ||
      c.id.startsWith("exclude:absent:") ||
      c.id.startsWith("exclude:soft:")
    )
      continue;
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
  // HANDOFF-4: soft suffix negation («X نداشته باشه» / «X نداره») is
  // an absence, like «بدون X» — merged here, never a hard exclude.
  // Only the "exclude:soft:" constraints from interpret.ts are merged;
  // the old "exclude:absent:" constraints (from «بدون») are untouched,
  // so «بدون خط و خش» stays exactly as today.
  for (const c of applied) {
    if (c.kind === "exclude" && c.id.startsWith("exclude:soft:")) {
      pushAbsent(c.value);
    }
  }
  // HANDOFF-4, rule 4: an exclude never equals the subject head (the
  // first include word). If it does, that exclude is not created.
  const headTokens = include.length > 0 ? tokenize(include[0]).join(" ") : "";
  let exclude = trueExcludes.filter(
    (t) => !absentKeys.has(tokenize(t).join(" "))
  );
  if (headTokens !== "") {
    exclude = exclude.filter((t) => tokenize(t).join(" ") !== headTokens);
  }

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

  // HANDOFF-2 (2026-11-01): strip the negated part from SHOULD text.
  // A purpose clause can carry the whole clause including «نه X»
  // («برای پنجره پذیرایی، پارچه‌ای ضخیم، نه کرکره و نه تور ساده»),
  // which would otherwise boost exactly the banned thing. Cut at the
  // first independent «نه» token («نهار»/«نهال» are untouched: they are
  // not a «نه» token), drop trailing conjunctions/preference cues,
  // then drop any token sequence that is itself an exclude term.
  // Anything without a negation passes through byte-identical.
  // Both surface forms: tokenized (contract SHOULD, ZWNJ already split)
  // and space-split (interpret preferences, ZWNJ kept).
  const excludeTokenSeqs = exclude.flatMap((t) => [
    tokenize(t),
    t.split(" ").filter(Boolean),
  ]);
  const cleanedShould: string[] = [];
  for (const s of should) {
    const toks = s.split(" ").filter(Boolean);
    const neIdx = toks.findIndex(
      (t) => t.replace(/[،,]+$/, "") === "نه"
    );
    let kept = neIdx >= 0 ? toks.slice(0, neIdx) : toks;
    while (
      kept.length > 0 &&
      ["و", "یا", "ترجیحاً", "ترجیحا", "ولی", "اما"].includes(
        kept[kept.length - 1].replace(/[،,]+$/, "")
      )
    ) {
      kept.pop();
    }
    const keptToks = kept.map((t) => t.replace(/[،,]+$/, ""));
    const out: string[] = [];
    for (let i = 0; i < keptToks.length; ) {
      let matched = 0;
      for (const seq of excludeTokenSeqs) {
        if (
          seq.length > 0 &&
          keptToks.slice(i, i + seq.length).join(" ") === seq.join(" ")
        ) {
          matched = Math.max(matched, seq.length);
        }
      }
      if (matched > 0) {
        i += matched;
      } else {
        out.push(kept[i]);
        i += 1;
      }
    }
    const cleaned = out.join(" ");
    if (cleaned !== "") cleanedShould.push(cleaned);
  }
  should.length = 0;
  should.push(...cleanedShould);

  // HANDOFF-4: strip negated, marker, price and inert tokens from
  // include and should. The rest of include is untouched, and the
  // subject head (include[0]) is never stripped by an exclude.
  // Price hard/softness is unchanged — only the words leave.
  {
    const removal = new Set<string>();
    for (const t of exclude) for (const tok of tokenize(t)) removal.add(tok);
    // Absent words are not content either — the same filter the contract
    // applies to its own mustNot stems. This is what makes a soft
    // «نداشته باشه» behave like «بدون»: its words leave include too.
    for (const t of absentAttributes) for (const tok of tokenize(t)) removal.add(tok);
    for (const m of [
      "نباشه", "نباشد", "نیست", "نیستش", "نداشته", "باشه", "باشد", "نداره",
    ])
      for (const tok of tokenize(m)) removal.add(tok);
    // Price tokens: cue + number + unit (typo units included). Only
    // the number in a price pattern is removed, so «آیفون ۱۵» keeps ۱۵.
    const priceRe =
      /(?:کمتر از|بیشتر از|پایین‌تر از|پایین تر از|زیر|حداکثر|حداقل|بالای|تا)\s+([\d۰-۹]+)\s*(میلیارد|میلیون|ملییون|ملیون|میلون|میل|هزار|تومان|ت)(?=\s|$|[،,])/g;
    let pm: RegExpExecArray | null;
    while ((pm = priceRe.exec(def.query)) !== null) {
      removal.add(pm[1]);
      removal.add(pm[2]);
    }
    // Double negation «بدون X نباشه/نباشد»: X is inert — remove it
    // from include, exclude and absentAttributes as well.
    const inert = new Set<string>();
    {
      const qtoks = normalizeForMatch(def.query).split(" ").filter(Boolean);
      const bi = qtoks.indexOf("بدون");
      if (bi >= 0) {
        for (let j = bi + 1; j < qtoks.length; j++) {
          if (qtoks[j] === "نباشه" || qtoks[j] === "نباشد") {
            for (const tok of qtoks.slice(bi + 1, j)) {
              if (tok !== "و" && tok !== "یا") {
                for (const st of tokenize(tok)) inert.add(st);
              }
            }
            break;
          }
          if (j - bi > 4) break;
        }
      }
    }
    for (const tok of inert) removal.add(tok);
    const keptInclude = include.filter((term, idx) => {
      if (idx === 0) return true;
      const toks = tokenize(term);
      return !(toks.length > 0 && toks.every((t) => removal.has(t)));
    });
    include.splice(0, include.length, ...keptInclude);
    exclude = exclude.filter((t) => {
      const toks = tokenize(t);
      return !(toks.length > 0 && toks.every((tok) => inert.has(tok)));
    });
    const keptAbsent = absentAttributes.filter((t) => {
      const toks = tokenize(t);
      return !(toks.length > 0 && toks.every((tok) => inert.has(tok)));
    });
    absentAttributes.splice(0, absentAttributes.length, ...keptAbsent);
    const priceCues = new Set(["زیر", "تا", "حداکثر", "حداقل", "بالای"]);
    const strippedShould: string[] = [];
    for (const s of should) {
      const kept = s
        .split(" ")
        .filter(Boolean)
        .filter((tok) => {
          const toks = tokenize(tok);
          return !(toks.length > 0 && toks.every((t) => removal.has(t)));
        });
      if (kept.length === 0) continue;
      if (kept.every((tok) => priceCues.has(tok))) continue;
      strippedShould.push(kept.join(" "));
    }
    should.length = 0;
    should.push(...strippedShould);
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
