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
  // HANDOFF-N: a stored definition's anyOf groups round-trip (the kamin
  // replay path rebuilds through here); resolveHuntDefinition recomputes
  // them fresh from the query for live hunts.
  const strArrArr = (v: unknown): string[][] =>
    Array.isArray(v)
      ? v
          .filter((x): x is unknown[] => Array.isArray(x))
          .map((x) => x.filter((y): y is string => typeof y === "string"))
          .filter((x) => x.length > 0)
      : [];
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
    includeAnyOf: strArrArr(b.includeAnyOf),
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
  // HANDOFF-N: reassigned to "preference" below when the city is named
  // only inside ترجیحاً domains.
  let citySource: "text" | "picker" | "preference" = cityC
    ? "text"
    : "picker";

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
  // HANDOFF-5: soft preferred bounds («ترجیحاً زیر X») ride the
  // "preferredPriceMax:/preferredPriceMin:" ids from interpret.ts.
  // They are never hard filters and never fail open against each other.
  const prefMaxC = applied.find((c) => c.id.startsWith("preferredPriceMax:"));
  const prefMinC = applied.find((c) => c.id.startsWith("preferredPriceMin:"));
  const preferredPriceMax = prefMaxC ? prefMaxC.value : "";
  const preferredPriceMin = prefMinC ? prefMinC.value : "";
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
    // HANDOFF-N: letter-numbers count too («زیر ده میل» removes ده/میل).
    const priceRe =
      /(?:کمتر از|بیشتر از|پایین‌تر از|پایین تر از|زیر|حداکثر|حداقل|بالای|تا)\s+([\d۰-۹]+|یک|دو|سه|پنج|ده|صد)\s*(میلیارد|میلیون|ملییون|ملیون|میلون|ملیارد|میل|هزار|تومان|تومن|ت)(?=\s|$|[،,])/g;
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

  // HANDOFF-5 (2026-11-02): numeric intake, last pass so no earlier
  // cleaning re-strips its additions. Only include/should move here;
  // exclude, absentAttributes, city, category, and hard prices are
  // untouched. Rules, in order: (4) year floor, (1-2) number ranges
  // and spec units, (3) bare cue+number, (7) function words. A number
  // is removed from include only when its own expression consumes it;
  // bare numbers («پژو ۲۰۶»، «آیفون ۱۳») and «مدل N» alone are kept.
  let yearMin: number | null = null;
  {
    const qToks = normalizeForMatch(def.query).split(" ").filter(Boolean);
    const faNum = (s: string): number | null => {
      const en = s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
      if (!/^\d+$/.test(en)) return null;
      const n = Number(en);
      return Number.isFinite(n) ? n : null;
    };
    const isNum = (t: string | undefined) => t !== undefined && faNum(t) !== null;
    const MONEY_UNITS = new Set([
      "میلیارد", "میلیون", "میلون", "ملیون", "ملییون", "ملیارد",
      "میل", "هزار", "تومان", "تومن", "ت",
    ]);
    const SPEC_UNITS = new Set([
      "متر", "متری", "گیگ", "گیگابایت", "مگ", "مگابایت", "ترابایت",
      "اینچ", "لیتر", "وات", "سی‌سی", "سیسی", "کیلو", "نفره", "ساله",
    ]);
    // Rule 7: function words never enter include — HANDOFF-N: «یک»
    // joins them, EXCEPT when the next word is one of the count nouns
    // below («یک خوابه» means something; «یه گوشی» does not).
    const FUNCTION_WORDS = new Set([
      "در", "یه", "یک", "با", "از", "برای", "به", "که", "را", "یا",
    ]);
    const ONE_EXCEPTIONS = new Set([
      "خوابه", "خواب", "طبقه", "نفره", "ساله", "ماهه", "متری", "کاره",
    ]);
    const keepOne = new Set<string>();
    for (let i = 0; i + 1 < qToks.length; i++) {
      if (
        (qToks[i] === "یک" || qToks[i] === "یه") &&
        ONE_EXCEPTIONS.has(qToks[i + 1])
      ) {
        keepOne.add(qToks[i]);
      }
    }
    const consumed = new Set<number>();
    const shouldAdd: string[] = [];
    const pushShould = (v: string) => {
      if (v !== "" && !shouldAdd.includes(v)) shouldAdd.push(v);
    };

    // Year floor: «مدل N به بالا», «N به بالا», «از N به بعد».
    // N is 1300–1499, or 50–99 meaning 1300+N. Anything else leaves
    // today's output untouched. First valid expression wins.
    for (let i = 0; i < qToks.length && yearMin === null; i++) {
      let numIdx = -1;
      let span: number[] = [];
      if (
        qToks[i] === "مدل" && isNum(qToks[i + 1]) &&
        qToks[i + 2] === "به" && qToks[i + 3] === "بالا"
      ) {
        numIdx = i + 1;
        span = [i, i + 1, i + 2, i + 3];
      } else if (
        isNum(qToks[i]) && qToks[i + 1] === "به" && qToks[i + 2] === "بالا"
      ) {
        numIdx = i;
        span = [i, i + 1, i + 2];
      } else if (
        qToks[i] === "از" && isNum(qToks[i + 1]) &&
        qToks[i + 2] === "به" && qToks[i + 3] === "بعد"
      ) {
        numIdx = i + 1;
        span = [i, i + 1, i + 2, i + 3];
      }
      if (numIdx < 0) continue;
      const raw = faNum(qToks[numIdx])!;
      if (raw >= 1300 && raw <= 1499) yearMin = raw;
      else if (raw >= 50 && raw <= 99) yearMin = 1300 + raw;
      else continue;
      for (const p of span) consumed.add(p);
    }

    // Ranges «X تا Y واحد» and single «N واحد»: the unit applies to
    // both numbers of a range. A money range only drops its first
    // number from include (the second is already stripped as a price);
    // a spec range drops both numbers and the unit, and the whole
    // phrase goes to should. A single spec unit keeps its number in
    // include and moves only the unit word to should.
    for (let i = 0; i < qToks.length; i++) {
      if (consumed.has(i)) continue;
      if (
        isNum(qToks[i]) && qToks[i + 1] === "تا" && isNum(qToks[i + 2]) &&
        (MONEY_UNITS.has(qToks[i + 3] ?? "") || SPEC_UNITS.has(qToks[i + 3] ?? ""))
      ) {
        const unit = qToks[i + 3];
        if (SPEC_UNITS.has(unit)) {
          pushShould(qToks.slice(i, i + 4).join(" "));
          consumed.add(i);
          consumed.add(i + 2);
          consumed.add(i + 3);
        } else {
          consumed.add(i);
        }
        i += 3;
        continue;
      }
      if (isNum(qToks[i]) && SPEC_UNITS.has(qToks[i + 1] ?? "")) {
        pushShould(qToks[i + 1]);
        consumed.add(i + 1);
        i += 1;
        continue;
      }
    }

    // Bare cue+number («رم حداقل ۱۶»): not a price without a unit.
    // The whole expression goes to should, the number leaves include.
    // A money or spec unit after the number means the price/unit paths
    // above already own it, so it is skipped here.
    const BARE_CUES: Array<readonly string[]> = [
      ["کمتر", "از"],
      ["بیشتر", "از"],
      ["پایین", "تر", "از"],
      ["زیر"],
      ["تا"],
      ["حداکثر"],
      ["حداقل"],
      ["بالای"],
    ];
    for (let i = 0; i < qToks.length; i++) {
      if (consumed.has(i)) continue;
      for (const cue of BARE_CUES) {
        const ni = i + cue.length;
        if (
          cue.every((c, k) => qToks[i + k] === c) &&
          isNum(qToks[ni]) && !consumed.has(ni)
        ) {
          const after = qToks[ni + 1];
          if (after !== undefined && (MONEY_UNITS.has(after) || SPEC_UNITS.has(after))) break;
          pushShould([...cue, qToks[ni]].join(" "));
          consumed.add(ni);
          break;
        }
      }
    }

    // Apply: drop include terms whose every surface token is consumed
    // or a function word. Single-token terms are the norm; the
    // every-token rule keeps phrases like «خط و خش» (و is not a
    // function word here) intact.
    const removalVals = new Set<string>();
    for (const p of consumed) removalVals.add(qToks[p]);
    for (const w of FUNCTION_WORDS) removalVals.add(w);
    const keptInclude = include.filter((term) => {
      const toks = normalizeForMatch(term).split(" ").filter(Boolean);
      // A lone «یک»/«یه» kept by the exception above survives.
      if (toks.length === 1 && keepOne.has(toks[0])) return true;
      return !(toks.length > 0 && toks.every((t) => removalVals.has(t)));
    });
    include.splice(0, include.length, ...keptInclude);
    const seenShould = new Set<string>();
    for (const t of include) for (const s of tokenize(t)) seenShould.add(s);
    for (const t of exclude) for (const s of tokenize(t)) seenShould.add(s);
    for (const t of should) seenShould.add(stemToken(t));
    for (const v of shouldAdd) {
      if (!seenShould.has(stemToken(v))) {
        should.push(v);
        seenShould.add(stemToken(v));
      }
    }
  }

  // HANDOFF-N (2026-11-02): sentence-understanding repairs. Only
  // include/should/city move here; exclude, absentAttributes and hard
  // prices are untouched.
  const includeAnyOf: string[][] = [];
  {
    const qToks = normalizeForMatch(def.query).split(" ").filter(Boolean);
    const termToks = (t: string) =>
      normalizeForMatch(t).split(" ").filter(Boolean);
    const isSingle = (t: string, w: string) => {
      const toks = termToks(t);
      return toks.length === 1 && toks[0] === w;
    };

    // B.1: «X یا Y» between two include terms becomes one anyOf group.
    // The group counts as ONE requirement, satisfied by either member.
    for (let i = 1; i + 1 < qToks.length; i++) {
      if (qToks[i] !== "یا") continue;
      const x = qToks[i - 1];
      const y = qToks[i + 1];
      const xi = include.findIndex((t) => isSingle(t, x));
      const yi = include.findIndex((t) => isSingle(t, y));
      if (xi < 0 || yi < 0 || xi === yi) continue;
      includeAnyOf.push([include[xi], include[yi]]);
      include.splice(Math.max(xi, yi), 1);
      include.splice(Math.min(xi, yi), 1);
    }

    // B.2: ZWNJ words stay one word. The contract splits them (its
    // surface split cuts ZWNJ), so merge adjacent fragments in include,
    // and repair a fragment whose other half the city lexicon swallowed
    // («بن» is a Divar city — «ری‌بن» reaches include as lone «ری»).
    const ZWNJ_WORDS: Array<[string, string, string]> = [
      ["لپ‌تاپ", "لپ", "تاپ"],
      ["سعادت‌آباد", "سعادت", "آباد"],
      ["ری‌بن", "ری", "بن"],
    ];
    for (const [word, f1, f2] of ZWNJ_WORDS) {
      // Compare in folded form: term/query tokens are normalized
      // («آباد»→«اباد»), while the stored word keeps its raw spelling.
      const ff1 = normalizeForMatch(f1).split(" ")[0];
      const ff2 = normalizeForMatch(f2).split(" ")[0];
      for (let i = 0; i + 1 < include.length; i++) {
        if (isSingle(include[i], ff1) && isSingle(include[i + 1], ff2)) {
          include.splice(i, 2, word);
          break;
        }
      }
      if (
        !include.some((t) => termToks(t).join(" ") === `${ff1} ${ff2}`) &&
        !include.includes(word)
      ) {
        const qi = qToks.findIndex(
          (t, i) => t === ff1 && qToks[i + 1] === ff2
        );
        const fi = include.findIndex((t) => isSingle(t, ff1));
        if (qi >= 0 && fi >= 0) include.splice(fi, 1, word);
      }
      for (let s = 0; s < should.length; s++) {
        const toks = should[s].split(" ").filter(Boolean);
        const out: string[] = [];
        for (let i = 0; i < toks.length; i++) {
          if (toks[i] === f1 && toks[i + 1] === f2) {
            out.push(word);
            i++;
          } else {
            out.push(toks[i]);
          }
        }
        should[s] = out.join(" ");
      }
    }

    // HANDOFF-2ب §1-الف (general rule, NO list): ANY ZWNJ-joined word
    // in the raw query stays one word. The contract splits ZWNJ, so
    // merge adjacent fragments back in include, should and exclude
    // whenever the raw query holds them joined. This generalizes B.2's
    // closed list (kept above for its lone-fragment repair, e.g.
    // «ری‌بن» whose other half the city lexicon swallowed — a lone
    // fragment has no adjacent pair to merge, so the general rule
    // cannot repair it and B.2 still must).
    // Fillers (می‌خوام، می‌خواهم، نمی‌خوام) can never resurrect here:
    // the merge only touches fragments already present in the term
    // lists, and fillers were dropped from them before this point.
    {
      const stripEdgePunct = (t: string) =>
        t.replace(/^[،,.!؟?()«»""''\[\]{}]+|[،,.!؟?()«»""''\[\]{}]+$/g, "");
      const rawQueryToks = def.query
        .split(/[\s،,.!؟?]+/)
        .filter(Boolean)
        .map(stripEdgePunct)
        .filter(Boolean);
      const mergePhrase = (phrase: string, folded: string[], word: string) => {
        const toks = phrase.split(" ").filter(Boolean);
        const out: string[] = [];
        for (let i = 0; i < toks.length; ) {
          const hit =
            folded.length > 0 &&
            folded.every(
              (f, k) =>
                normalizeForMatch(toks[i + k] ?? "").split(" ")[0] === f
            );
          if (hit) {
            out.push(word);
            i += folded.length;
          } else {
            out.push(toks[i]);
            i += 1;
          }
        }
        return out.join(" ");
      };
      for (const raw of rawQueryToks) {
        if (!raw.includes("‌")) continue;
        const frags = raw.split("‌").filter(Boolean);
        if (frags.length < 2) continue;
        const folded = frags
          .map((f) => normalizeForMatch(f).split(" ")[0])
          .filter(Boolean);
        if (folded.length !== frags.length) continue;
        // include: consecutive single terms, or one phrase entry holding
        // the whole fragment run.
        for (let i = 0; i + folded.length <= include.length; i++) {
          if (
            folded.every((f, k) => isSingle(include[i + k], f))
          ) {
            include.splice(i, folded.length, raw);
            break;
          }
        }
        // Repair: a fragment the contract dropped as a verb/filler
        // («کن» in «سرخ‌کن» — contract.ts is out of scope, so the
        // fragment never reaches include). If the first fragment
        // survived alone, restore the full word in its place. Fillers
        // cannot repair: their first fragment is never in include
        // (both halves were dropped), so no lone fragment exists.
        if (
          !include.includes(raw) &&
          !include.some(
            (t) => termToks(t).join(" ") === folded.join(" ")
          )
        ) {
          const fi = include.findIndex((t) => isSingle(t, folded[0]));
          if (fi >= 0) {
            include.splice(fi, 1, raw);
            // Other fragments of the same word must not linger as
            // separate MUST terms (they would fail their own match
            // and drag an exact down to near).
            for (let j = include.length - 1; j >= 0; j--) {
              if (
                j !== fi &&
                folded.slice(1).some((f) => isSingle(include[j], f))
              ) {
                include.splice(j, 1);
              }
            }
          }
        }
        for (let i = 0; i < include.length; i++) {
          if (termToks(include[i]).join(" ") === folded.join(" ")) {
            include[i] = raw;
          }
        }
        for (let s = 0; s < should.length; s++) {
          should[s] = mergePhrase(should[s], folded, raw);
        }
        for (let e = 0; e < exclude.length; e++) {
          exclude[e] = mergePhrase(exclude[e], folded, raw);
        }
      }
    }

    // B.3: «X دار» joins to «X‌دار». A حتماً-scoped pair stays a MUST
    // (include); an unscoped pair is a feature, so it moves to SHOULD.
    // Any other bare «دار» never stays in include.
    for (const x of ["پایه", "حیاط"]) {
      const joined = `${x}‌دار`;
      // Folded comparison («حیاط»→«حیات» under normalization); the
      // stored word keeps its raw spelling.
      const fx = normalizeForMatch(x).split(" ")[0];
      let scoped = false;
      for (let k = 0; k + 2 < qToks.length; k++) {
        if (
          (qToks[k] === "حتماً" || qToks[k] === "حتما") &&
          qToks[k + 1] === fx &&
          qToks[k + 2] === "دار"
        ) {
          scoped = true;
          break;
        }
      }
      for (let i = 0; i + 1 < include.length; i++) {
        if (!isSingle(include[i], fx) || !isSingle(include[i + 1], "دار"))
          continue;
        if (scoped) {
          include.splice(i, 2, joined);
        } else {
          include.splice(i, 2);
          if (!should.includes(joined)) should.push(joined);
        }
        break;
      }
      for (let s = 0; s < should.length; s++) {
        const toks = should[s].split(" ").filter(Boolean);
        const out: string[] = [];
        for (let i = 0; i < toks.length; i++) {
          if (toks[i] === x && toks[i + 1] === "دار") {
            out.push(joined);
            i++;
          } else {
            out.push(toks[i]);
          }
        }
        should[s] = out.join(" ");
      }
    }
    for (let i = include.length - 1; i >= 0; i--) {
      if (isSingle(include[i], "دار")) include.splice(i, 1);
    }

    // B.4: the «تخت خواب» subject. The contract's city branch swallows
    // «تخت» (a Divar city name), leaving lone «خواب» — replace it with
    // the full subject, or insert the subject when it is absent.
    if (qToks[0] === "تخت" && qToks[1] === "خواب") {
      const خوابIdx = include.findIndex((t) => {
        const toks = termToks(t);
        return toks.length === 1 && toks[0] === "خواب";
      });
      const fullIdx = include.findIndex((t) => {
        const toks = termToks(t);
        return toks.length === 2 && toks[0] === "تخت" && toks[1] === "خواب";
      });
      if (خوابIdx >= 0) include.splice(خوابIdx, 1, "تخت خواب");
      else if (fullIdx < 0) include.unshift("تخت خواب");
    }

    // B.8: a «<city> زیر» leftover in SHOULD (a city + price cue from a
    // ترجیحاً domain whose price was already lifted) is not a wish.
    if (city !== "all") {
      const cityNames = KNOWN_CITIES.find((c) => c.id === city)?.names ?? [];
      const cityToks = new Set(
        cityNames.map((n) => normalizeForMatch(n).split(" ").filter(Boolean).join(" "))
      );
      for (let s = should.length - 1; s >= 0; s--) {
        const toks = normalizeForMatch(should[s]).split(" ").filter(Boolean);
        if (
          toks.length === 2 &&
          toks[1] === "زیر" &&
          cityToks.has(toks[0])
        ) {
          should.splice(s, 1);
        }
      }
    }

    // B.8 (city source): a city named ONLY inside ترجیحاً domains is
    // preferred, not hard. Any mention outside a domain keeps it hard.
    if (city !== "all" && citySource === "text") {
      const rawToks = def.query.split(/\s+/).filter(Boolean);
      const stripPunct = (t: string) => t.replace(/[،,.]+$/, "");
      const domainIdx = new Set<number>();
      for (let i = 0; i < rawToks.length; i++) {
        const cue = stripPunct(rawToks[i]);
        if (cue !== "ترجیحاً" && cue !== "ترجیحا") continue;
        for (let j = i + 1; j < rawToks.length; j++) {
          const clean = stripPunct(rawToks[j]);
          if (clean === "و" || clean === "حتماً" || clean === "حتما") break;
          domainIdx.add(j);
          if (/[،,]$/.test(rawToks[j])) break;
        }
      }
      const citySeqs = (
        KNOWN_CITIES.find((c) => c.id === city)?.names ?? []
      ).map((n) => normalizeForMatch(n).split(" ").filter(Boolean));
      const seqHas = (toks: string[], seq: string[]) =>
        seq.length > 0 &&
        toks.some((_, i) => seq.every((s, k) => toks[i + k] === s));
      const domainToks = rawToks
        .filter((_, i) => domainIdx.has(i))
        .map(stripPunct);
      const outsideToks = rawToks
        .filter((_, i) => !domainIdx.has(i))
        .map(stripPunct);
      const inDomain = citySeqs.some((seq) => seqHas(domainToks, seq));
      const outside = citySeqs.some((seq) => seqHas(outsideToks, seq));
      if (inDomain && !outside) citySource = "preference";
    }
  }

  return {
    ...def,
    include,
    includeAnyOf,
    exclude,
    absentAttributes,
    should,
    city,
    citySource,
    category,
    priceMin,
    priceMax,
    yearMin,
    preferredPriceMax,
    preferredPriceMin,
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
