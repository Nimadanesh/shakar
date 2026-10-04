import { normalizePersian } from "@/lib/normalizePersian";
import type { Interpretation, InterpretedConstraint } from "@/types/search";

const KNOWN_CITIES: Array<{ id: string; names: string[] }> = [
  { id: "tehran", names: ["تهران"] },
  { id: "karaj", names: ["کرج"] },
  { id: "isfahan", names: ["اصفهان"] },
  { id: "shiraz", names: ["شیراز"] },
  { id: "mashhad", names: ["مشهد"] },
  { id: "tabriz", names: ["تبریز"] },
];

const UNIT_MULTIPLIER: Array<{ unit: string; factor: number }> = [
  { unit: "میلیارد", factor: 1_000_000_000 },
  { unit: "میلیون", factor: 1_000_000 },
  { unit: "هزار", factor: 1_000 },
];

const MAX_PATTERNS = ["زیر", "حداکثر", "تا", "کمتر از", "پایین‌تر از", "پایین تر از"];
const MIN_PATTERNS = ["بالای", "بیشتر از", "حداقل"];
const NEGATION_VERBS = ["نمی‌خوام", "نمیخوام", "نمی‌خواهم", "نمیخواهم", "نمی‌خواد", "نمیخواد", "نه"];
const EXCLUDE_PREFIXES = ["بدون", "به‌جز", "بجز", "غیر از", "غیراز"];
const PREFERENCE_CUES = ["ترجیحاً", "ترجیحا", "کاش", "ای کاش"];

function faToEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function parseAmount(raw: string, unit: string | undefined): number | null {
  const digits = faToEnDigits(raw).replace(/[^\d]/g, "");
  if (digits === "") return null;
  const factor = UNIT_MULTIPLIER.find((u) => u.unit === unit)?.factor ?? 1;
  return Number(digits) * factor;
}

const AMOUNT = "([\\d۰-۹٠-٩][\\d۰-۹٠-٩\\s,،.٬]*)";
const UNIT = "(میلیارد|میلیون|هزار|تومان|ت)?";

function findPriceBound(normalized: string, kind: "min" | "max"): { value: number; display: string } | null {
  const patterns = kind === "max" ? MAX_PATTERNS : MIN_PATTERNS;
  for (const cue of patterns) {
    const match = normalized.match(new RegExp(`${cue}\\s+${AMOUNT}\\s*${UNIT}`));
    if (!match) continue;
    const value = parseAmount(match[1], match[2]);
    if (value === null) continue;
    const rawAmount = match[1].trim();
    const scaleUnit = match[2] === "میلیارد" || match[2] === "میلیون" || match[2] === "هزار";
    const displayAmount = scaleUnit ? `${rawAmount} ${match[2]}` : `${value.toLocaleString("fa-IR")} تومان`;
    return {
      value,
      display: kind === "max" ? `تا ${displayAmount}` : `از ${displayAmount}`,
    };
  }
  return null;
}

function splitSegments(normalized: string): string[] {
  return normalized
    .split(/[،,.!؟?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function pushUnique(list: InterpretedConstraint[], item: InterpretedConstraint): void {
  if (!list.some((c) => c.id === item.id)) list.push(item);
}

function addExcludeTerm(list: InterpretedConstraint[], rawTerm: string): void {
  const push = (term: string) => {
    const words = term.split(" ").filter(Boolean);
    if (term !== "" && words.length <= 3) {
      pushUnique(list, {
        id: `exclude:${term}`,
        kind: "exclude",
        value: term,
        display: term,
        source: "inferred",
        applied: true,
      });
    }
  };
  const term = normalizePersian(rawTerm);
  if (term.split(" ").filter(Boolean).length > 3 && term.includes(" و ")) {
    for (const part of term.split(" و ")) push(normalizePersian(part));
    return;
  }
  push(term);
}

/**
 * Conservative rule-based interpretation of a Persian natural-language query.
 * Only high-confidence patterns (known city, explicit price bound, explicit
 * negation, preference cue) produce constraints. Vague language yields nothing:
 * unknown stays unknown and the raw query is preserved untouched.
 */
export function interpretQuery(raw: string): Interpretation {
  const applied: InterpretedConstraint[] = [];
  const preferences: InterpretedConstraint[] = [];
  const normalized = normalizePersian(raw);
  if (normalized === "") return { applied, preferences };

  for (const city of KNOWN_CITIES) {
    if (city.names.some((name) => normalized.includes(name))) {
      pushUnique(applied, {
        id: `city:${city.id}`,
        kind: "city",
        value: city.id,
        display: city.names[0],
        source: "inferred",
        applied: true,
      });
      break;
    }
  }

  const max = findPriceBound(normalized, "max");
  if (max) {
    pushUnique(applied, {
      id: `priceMax:${max.value}`,
      kind: "priceMax",
      value: String(max.value),
      display: max.display,
      source: "inferred",
      applied: true,
    });
  }
  const min = findPriceBound(normalized, "min");
  if (min) {
    pushUnique(applied, {
      id: `priceMin:${min.value}`,
      kind: "priceMin",
      value: String(min.value),
      display: min.display,
      source: "inferred",
      applied: true,
    });
  }

  for (const segment of splitSegments(normalized)) {
    const negation = segment.match(
      new RegExp(`^(.+?)\\s+(${NEGATION_VERBS.join("|")})$`)
    );
    if (negation) {
      addExcludeTerm(applied, negation[1]);
      continue;
    }
    for (const prefix of EXCLUDE_PREFIXES) {
      const marker = `${prefix} `;
      const at = segment.indexOf(marker);
      if (at >= 0) {
        addExcludeTerm(applied, segment.slice(at + marker.length));
        break;
      }
    }
    for (const cue of PREFERENCE_CUES) {
      const idx = segment.indexOf(cue);
      if (idx >= 0) {
        const wish = normalizePersian(segment.slice(idx + cue.length));
        if (wish !== "") {
          pushUnique(preferences, {
            id: `preference:${wish}`,
            kind: "preference",
            value: wish,
            display: wish,
            source: "inferred",
            applied: false,
          });
        }
        break;
      }
    }
  }

  return { applied, preferences };
}
