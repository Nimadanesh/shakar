/**
 * Intent contract (Decision v2 — Phase 1 / Experiment B, sec.6).
 *
 * Model page: ~/workspace/your_files/contract-model-page.md. In one line:
 * a registration input becomes C = (subject, MUST, SHOULD, MUST_NOT,
 * UNKNOWN, price bounds, city, direction, kind) where every entry traces
 * to a token span of the input, polarity is the user's own, and anything
 * undecidable stays UNKNOWN — UNKNOWN never deletes and never compels.
 *
 * Why this exists: the legacy parser (interpret.ts + definition.ts)
 * computed the absence term as "the rest of the segment after بدون" and
 * silently dropped it when it exceeded 3 words — the R3/B01/B02 polarity
 * inversions. This module replaces clause parsing with a token-stream
 * scanner that accounts for EVERY token (subject is the visible sink;
 * fillers are dropped on the record, never silently).
 *
 * Price/city/preference inference is lifted from interpretQuery (those
 * measured 4/4 + correct on the frozen probe); clause polarity, subject
 * phrases, direction and coverage accounting are owned here.
 */
import {
  interpretQuery,
  KNOWN_CITIES,
  DEMAND_VERBS,
  detectServiceIntent,
} from "@/lib/interpret";
import { tokenize, normalizeForMatch } from "@/lib/persianNormalize";

export interface ContractTerm {
  text: string;
  /** token span [start, end) in the tokenized input — the evidence. */
  span: [number, number];
}

export type ContractDirection =
  | "seeking-item"
  | "seeking-sellers"
  | "seeking-service"
  | "offering";

export interface IntentContract {
  subject: ContractTerm | null;
  must: ContractTerm[];
  should: ContractTerm[];
  /** desired absences («بدون X») — conditions, not bans. */
  mustNot: ContractTerm[];
  /** true bans («نه X»). */
  exclude: ContractTerm[];
  priceMin: number | null;
  priceMax: number | null;
  city: string | null;
  locationNote: string | null;
  direction: ContractDirection | null;
  condition: "new" | "used" | null;
  yearMin: number | null;
  /** Always UNKNOWN at this layer — kind is decided downstream. */
  kind: "UNKNOWN";
  /** command/filler tokens, dropped ON THE RECORD (coverage). */
  dropped: ContractTerm[];
  sourceText: string;
}

const FILLERS = new Set([
  "حتما",
  "حتماً",
  "باشه",
  "باشد",
  "لطفا",
  "لطفاً",
  "خوام",
]);
const UNITS = new Set([
  "گیگ",
  "گیگابایت",
  "مگ",
  "مگابایت",
  "ترابایت",
  "اینچ",
  "لیتر",
  "وات",
  "سی‌سی",
  "سیسی",
]);
const PRICE_WORDS = new Set(["میلیون", "میلیارد", "تومان", "هزار"]);
const REGION_WORDS = new Set(["شمال", "جنوب", "شرق", "غرب"]);
const CONDITION_NEW = new Set(["آکبند", "اکبند", "نو"]);
const SERVICE_AGENT_MAP: Record<string, string> = { نصاب: "نصب" };
const NEGATED_PAST = new Set(["نشده", "نشده‌است"]);
const DOUBLE_NEG = new Set(["نباشه", "نباشد"]);

const isDigitTok = (t: string) => /^[0-9۰-۹]+$/.test(t);

function cityTokenMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of KNOWN_CITIES)
    for (const name of c.names) m.set(normalizeForMatch(name), c.id);
  return m;
}

/**
 * Build the contract from free text. Every token of the input lands in
 * exactly one bucket; the scanner below is the single pass that does it.
 */
export function buildContract(raw: string): IntentContract {
  const interp = interpretQuery(raw);
  const applied = interp.applied;
  const liftedMax = applied.find((c) => c.kind === "priceMax");
  const liftedMin = applied.find((c) => c.kind === "priceMin");
  const liftedCity = applied.find((c) => c.kind === "city");

  const tokens = tokenize(raw);
  const n = tokens.length;
  const bucket: string[] = new Array(n).fill("");
  const cities = cityTokenMap();

  const out: IntentContract = {
    subject: null,
    must: [],
    should: [],
    mustNot: [],
    exclude: [],
    priceMin: liftedMin ? Number(liftedMin.value) : null,
    priceMax: liftedMax ? Number(liftedMax.value) : null,
    city: liftedCity ? liftedCity.value : null,
    locationNote: null,
    direction: null,
    condition: null,
    yearMin: null,
    kind: "UNKNOWN",
    dropped: [],
    sourceText: raw,
  };
  const term = (from: number, to: number): ContractTerm => ({
    text: tokens.slice(from, to).join(" "),
    span: [from, to],
  });
  const claim = (from: number, to: number, b: string) => {
    for (let k = from; k < to; k++) bucket[k] = b;
  };

  // Pass A — verb-negation absences anywhere in the stream:
  // «X نشده (باشه)» => MUST_NOT(X). Runs before the walk so the
  // auxiliary «باشه» is consumed by the pattern, not seen as filler.
  for (let i = 1; i < n; i++) {
    if (!NEGATED_PAST.has(tokens[i]) || bucket[i]) continue;
    let j = i - 1;
    if (bucket[j] || FILLERS.has(tokens[j])) continue;
    let end = i + 1;
    if (end < n && tokens[end] === "باشه") end++;
    out.mustNot.push(term(j, j + 1));
    claim(j, end, "mustNot");
  }

  // Pass B — the clause walk.
  let subjectDigits = false;
  let i = 0;
  const isClauseStarter = (idx: number): boolean => {
    if (idx >= n) return true;
    const t = tokens[idx];
    return (
      t === "بدون" ||
      t === "برای" ||
      FILLERS.has(t) ||
      cities.has(normalizeForMatch(t)) ||
      (t === "تا" && idx + 1 < n && isDigitTok(tokens[idx + 1])) ||
      isDigitTok(t)
    );
  };
  while (i < n) {
    if (bucket[i]) {
      i++;
      continue;
    }
    const t = tokens[i];

    // price phrase tokens — the VALUE comes from interpretQuery; here we
    // only account for the span so coverage stays total.
    if (
      PRICE_WORDS.has(t) ||
      (isDigitTok(t) &&
        i + 1 < n &&
        PRICE_WORDS.has(tokens[i + 1])) ||
      ((t === "تا" || t === "زیر" || t === "از" || t === "حداکثر" || t === "حداقل") &&
        i + 1 < n &&
        isDigitTok(tokens[i + 1]))
    ) {
      bucket[i] = "price";
      i++;
      continue;
    }
    if (cities.has(normalizeForMatch(t))) {
      if (!out.city) out.city = cities.get(normalizeForMatch(t))!;
      bucket[i] = "city";
      i++;
      continue;
    }
    if (REGION_WORDS.has(t)) {
      out.locationNote = t;
      bucket[i] = "region";
      i++;
      continue;
    }
    if (DEMAND_VERBS.includes(t) || FILLERS.has(t) || t === "می" || t === "و") {
      // A standalone «و» between clauses is a separator, not content.
      out.dropped.push(term(i, i + 1));
      bucket[i] = "dropped";
      i++;
      continue;
    }
    if (t === "خریدار") {
      // R6 ruling (navid): a bare «خریدار X» hunt seeks BUYER ads —
      // the hunter has something to sell. Role word, never a term.
      out.direction = "seeking-sellers";
      bucket[i] = "direction";
      i++;
      continue;
    }
    if (t === "فروشنده") {
      out.direction = "seeking-item";
      bucket[i] = "direction";
      i++;
      continue;
    }
    if (SERVICE_AGENT_MAP[t] || (t.length > 3 && t.endsWith("کار"))) {
      const action = SERVICE_AGENT_MAP[t] ?? t.slice(0, -3); // strip «کار»
      out.direction = "seeking-service";
      out.must.push({ text: action, span: [i, i + 1] });
      bucket[i] = "must";
      i++;
      continue;
    }
    if (t === "بدون") {
      // Absence clause: consume the attribute until a clause boundary.
      // «و» is a boundary only when what follows starts a new clause
      // («و بدون…», «و تا…»); inside an attribute («خط و خش») it binds.
      let j = i + 1;
      const attrStart = j;
      while (j < n && !bucket[j]) {
        if (j > attrStart) {
          if (DOUBLE_NEG.has(tokens[j])) break; // flip handled after the loop
          if (tokens[j] === "و") {
            if (isClauseStarter(j + 1)) break;
            j += 2; // internal و + the token after it
            continue;
          }
          if (isClauseStarter(j)) break;
          if (j - attrStart >= 4) break; // attribute span cap; rest re-enters the walk
        }
        j++;
      }
      if (j > attrStart) {
        // Double negation: «بدون X نباشه» = X is REQUIRED.
        if (j < n && DOUBLE_NEG.has(tokens[j])) {
          out.must.push(term(attrStart, j));
          claim(attrStart, j + 1, "must");
          i = j + 1;
        } else {
          out.mustNot.push(term(attrStart, j));
          claim(attrStart, j, "mustNot");
          i = j;
        }
      } else {
        bucket[i] = "dropped";
        out.dropped.push(term(i, i + 1));
        i++;
      }
      continue;
    }
    if (t === "برای") {
      let j = i + 1;
      while (j < n && !bucket[j] && !isClauseStarter(j)) j++;
      if (j > i + 1) {
        out.should.push(term(i + 1, j));
        claim(i, j, "should");
        i = j;
      } else {
        bucket[i] = "dropped";
        out.dropped.push(term(i, i + 1));
        i++;
      }
      continue;
    }
    if (t === "مدل" && i + 1 < n && isDigitTok(tokens[i + 1])) {
      let end = i + 2;
      let floor = false;
      if (
        end + 1 < n &&
        tokens[end] === "به" &&
        (tokens[end + 1] === "بالا" || tokens[end + 1] === "بالا‌")
      ) {
        floor = true;
        end += 2;
      }
      out.must.push(term(i, end));
      if (floor) out.yearMin = Number(tokens[i + 1].replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString()));
      claim(i, end, "must");
      i = end;
      continue;
    }
    if (isDigitTok(t) && i + 1 < n && UNITS.has(tokens[i + 1])) {
      out.must.push(term(i, i + 2));
      claim(i, i + 2, "must");
      i += 2;
      continue;
    }
    if (isDigitTok(t) && subjectDigits) {
      // A second bare number after the subject already carries one is a
      // spec (۲۵۶ storage), not another model fragment. Heuristic —
      // labeled as such; the subject-digit rule is what the probes pin.
      out.must.push(term(i, i + 1));
      bucket[i] = "must";
      i++;
      continue;
    }
    if (CONDITION_NEW.has(t)) {
      out.condition = "new";
      out.must.push(term(i, i + 1));
      bucket[i] = "must";
      i++;
      continue;
    }
    // Default sink: subject phrase (visible in the contract, correctable
    // by the user in the form — never a silent drop).
    if (isDigitTok(t)) subjectDigits = true;
    bucket[i] = "subject";
    i++;
  }
  const subjIdx = bucket
    .map((b, idx) => (b === "subject" ? idx : -1))
    .filter((x) => x >= 0);
  if (subjIdx.length) {
    out.subject = {
      text: subjIdx.map((idx) => tokens[idx]).join(" "),
      span: [subjIdx[0], subjIdx[subjIdx.length - 1] + 1],
    };
  }
  for (const p of interp.preferences) {
    out.should.push({ text: p.value, span: [-1, -1] });
  }
  if (!out.direction && detectServiceIntent(raw))
    out.direction = "seeking-service";
  return out;
}

/**
 * Build the contract from structured form fields (the product's real
 * registration path). Fields are already explicit — the mapping must be
 * faithful: nothing the form holds may collapse away.
 */
export function contractFromFields(fields: {
  subject?: string;
  include?: string[];
  exclude?: string[];
  priceMin?: string | number;
  priceMax?: string | number;
  city?: string;
  direction?: ContractDirection;
}): IntentContract {
  const numOrNull = (v: string | number | undefined): number | null => {
    if (v === undefined) return null;
    const d = String(v).replace(/[^0-9]/g, "");
    return d ? Number(d) : null;
  };
  const terms = (arr?: string[]): ContractTerm[] =>
    (arr ?? []).map((text) => ({ text, span: [-1, -1] as [number, number] }));
  return {
    subject: fields.subject
      ? { text: fields.subject, span: [-1, -1] }
      : null,
    must: terms(fields.include),
    should: [],
    mustNot: terms(fields.exclude),
    exclude: [],
    priceMin: numOrNull(fields.priceMin),
    priceMax: numOrNull(fields.priceMax),
    city: fields.city ?? null,
    locationNote: null,
    direction: fields.direction ?? null,
    condition: null,
    yearMin: null,
    kind: "UNKNOWN",
    dropped: [],
    sourceText: "",
  };
}
