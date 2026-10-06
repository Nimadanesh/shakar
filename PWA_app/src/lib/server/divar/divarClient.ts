import "server-only";

import {
  ProviderError,
  type DivarJson,
  type ListingDetail,
  type ListingProvider,
  type ListingQuery,
  type ListingSummary,
} from "./provider";
import { divarFetch, type RequestKind } from "./throttle";
import { getCached, getStale, setCached } from "./cache";
import { CATEGORY_API_VALUE, resolveCityId } from "./taxonomy";

const API_BASE = "https://api.divar.ir/v8";
const LIST_TTL_MS = 3 * 60 * 1000; // blueprint §3: list pages cache 2–5 min
// Deep pages hold OLDER ads, which don't move — they stay cached 60 min.
// Only page 0 (the freshest ads) refreshes every 3 min. This cuts list
// refresh traffic ~4x under load without losing any freshness.
const LIST_DEEP_TTL_MS = 60 * 60 * 1000;
const DETAIL_TTL_MS = 60 * 60 * 1000; // blueprint §3: details hourly

/** "۸۰۰,۰۰۰,۰۰۰ تومان" → 800000000. "توافقی"/missing → null (never 0). */
function parsePriceFa(text: string | undefined): number | null {
  if (!text) return null;
  const en = text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const digits = en.replace(/[^0-9]/g, "");
  if (digits === "") return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function asRecord(v: unknown): DivarJson | null {
  return typeof v === "object" && v !== null ? (v as DivarJson) : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

interface PostRowWidget {
  widget_type: string;
  data?: {
    title?: string;
    action?: {
      payload?: {
        token?: string;
        web_info?: { title?: string; district_persian?: string; city_persian?: string };
      };
    };
    image_url?: string;
    middle_description_text?: string;
    bottom_description_text?: string;
  };
}

function toSummary(w: PostRowWidget): ListingSummary | null {
  const d = w.data;
  const token = d?.action?.payload?.token;
  if (w.widget_type !== "POST_ROW" || !d || typeof token !== "string" || token === "")
    return null;
  const webInfo = d.action?.payload?.web_info;
  return {
    sourceAdId: token,
    title: webInfo?.title ?? d.title ?? "",
    price: parsePriceFa(d.middle_description_text),
    priceText: d.middle_description_text,
    city: webInfo?.city_persian ?? "",
    district: webInfo?.district_persian,
    thumbnail: d.image_url,
  };
}

function findSection(json: DivarJson, name: string): DivarJson | null {
  const sections = json.sections;
  if (!Array.isArray(sections)) return null;
  for (const s of sections) {
    const rec = asRecord(s);
    if (rec && rec.section_name === name) return rec;
  }
  return null;
}

function findWidget(section: DivarJson, type: string): DivarJson | null {
  const widgets = section.widgets;
  if (!Array.isArray(widgets)) return null;
  for (const w of widgets) {
    const rec = asRecord(w);
    if (!rec) continue;
    const data = asRecord(rec.data);
    if (rec.widget_type === type) return data;
  }
  return null;
}

function sectionText(json: DivarJson, sectionName: string, widgetType: string): string {
  const sec = findSection(json, sectionName);
  if (!sec) return "";
  const primary = findWidget(sec, widgetType);
  const text = asString(primary?.text);
  if (text) return text;
  // Fallback: some ads use a different title widget — take the first text.
  if (!Array.isArray(sec.widgets)) return "";
  for (const w of sec.widgets) {
    const t = asString(asRecord(asRecord(w)?.data)?.text);
    if (t) return t;
  }
  return "";
}

function detailPrice(json: DivarJson): { price: number | null; priceText?: string } {
  const sec = findSection(json, "LIST_DATA");
  if (!sec || !Array.isArray(sec.widgets)) return { price: null };
  for (const w of sec.widgets) {
    const rec = asRecord(w);
    const data = rec ? asRecord(rec.data) : null;
    const title = data ? asString(data.title) : null;
    if (rec?.widget_type === "UNEXPANDABLE_ROW" && title && title.includes("قیمت")) {
      const priceText = asString(data?.value);
      return { price: parsePriceFa(priceText ?? undefined), priceText: priceText ?? undefined };
    }
  }
  return { price: null };
}

function detailCategory(json: DivarJson): string {
  const sec = findSection(json, "BREADCRUMB");
  const data = sec ? findWidget(sec, "BREADCRUMB") : null;
  const items = data?.parent_items;
  if (!Array.isArray(items) || items.length === 0) return "";
  const last = asRecord(items[items.length - 1]);
  const payload = asRecord(asRecord(last?.action)?.payload);
  const searchData = asRecord(payload?.search_data);
  const formData = asRecord(searchData?.form_data);
  const dataObj = asRecord(formData?.data);
  const category = asRecord(dataObj?.category);
  const str = asRecord(category?.str);
  return asString(str?.value) ?? "";
}

function toDetail(token: string, json: DivarJson): ListingDetail {
  const { price, priceText } = detailPrice(json);
  const images: string[] = [];
  const imgSec = findSection(json, "IMAGE");
  const widgets = imgSec && Array.isArray(imgSec.widgets) ? imgSec.widgets : [];
  for (const w of widgets) {
    const url = asString(asRecord(asRecord(w)?.data)?.image_url);
    if (url) images.push(url);
  }
  const city = asString(json.city) ?? "";
  return {
    sourceAdId: token,
    title: sectionText(json, "TITLE", "LEGEND_TITLE_ROW"),
    price,
    priceText,
    city,
    district: undefined,
    description: sectionText(json, "DESCRIPTION", "DESCRIPTION_ROW"),
    images,
    categorySlug: detailCategory(json),
  };
}

function parseListJson(json: DivarJson): {
  listings: ListingSummary[];
  hasMore: boolean;
  nextCursor?: unknown;
} {
  const code = json.code;
  if (code !== undefined && json.message) {
    throw new ProviderError("bad-request", `Divar: ${String(json.message)}`);
  }
  const widgets = Array.isArray(json.list_widgets) ? json.list_widgets : [];
  const listings: ListingSummary[] = [];
  for (const w of widgets) {
    const rec = asRecord(w);
    if (!rec || typeof rec.widget_type !== "string") continue;
    const s = toSummary(rec as unknown as PostRowWidget);
    if (s) listings.push(s);
  }
  const pagination = asRecord(json.pagination);
  return {
    listings,
    hasMore: pagination?.has_next_page === true,
    nextCursor: pagination?.data,
  };
}

/**
 * FirstPartyDivarProvider — our own server-side Divar client (blueprint §4).
 * Talks to api.divar.ir through the single throttled executor; every
 * response is stripped to the fields the UI needs before it leaves here.
 */
class FirstPartyDivarProvider implements ListingProvider {
  readonly name = "divar-first-party";

  async searchLists(q: ListingQuery): Promise<{
    listings: ListingSummary[];
    hasMore: boolean;
    nextCursor?: unknown;
    stale?: boolean;
  }> {
    const categorySlug = q.categorySlug !== "" ? q.categorySlug : undefined;
    const body: Record<string, unknown> = {
      city_ids: q.cityId !== "" ? [q.cityId] : [],
      search_data: {
        form_data: {
          data: categorySlug ? { category: { str: { value: categorySlug } } } : {},
        },
      },
    };
    const cacheKey = `list:${q.cityId}:${categorySlug ?? "all"}:${q.page}`;
    const cached = getCached<DivarJson>(cacheKey);
    if (cached) return parseListJson(cached);
    try {
      const raw: unknown = await divarFetch(`${API_BASE}/postlist/w/search`, {
        method: "POST",
        body,
        kind: "list" as RequestKind,
      });
      const rec = asRecord(raw);
      if (!rec) throw new ProviderError("upstream-down", "Divar returned no JSON");
      setCached(cacheKey, rec, q.page === 0 ? LIST_TTL_MS : LIST_DEEP_TTL_MS);
      return parseListJson(rec);
    } catch (e) {
      // Divar is restricting us — a ban is a normal state, not a death.
      // Serve the last good list when we have one; the pipeline must
      // surface `stale` honestly and never present it as fresh.
      if (
        e instanceof ProviderError &&
        (e.errorClass === "rate-limited" ||
          e.errorClass === "upstream-down" ||
          e.errorClass === "timeout")
      ) {
        const stale = getStale<DivarJson>(cacheKey);
        if (stale) {
          try {
            return { ...parseListJson(stale), hasMore: false, stale: true as const };
          } catch {
            /* fall through to throw */
          }
        }
      }
      throw e;
    }
  }

  async getDetail(sourceAdId: string): Promise<ListingDetail> {
    const cacheKey = `detail:${sourceAdId}`;
    const cached = getCached<DivarJson>(cacheKey);
    if (cached) return toDetail(sourceAdId, cached);
    try {
      const raw: unknown = await divarFetch(
        `${API_BASE}/posts-v2/web/${encodeURIComponent(sourceAdId)}`,
        { method: "GET", kind: "detail" as RequestKind }
      );
      const rec = asRecord(raw);
      if (!rec) throw new ProviderError("upstream-down", "Divar returned no JSON");
      setCached(cacheKey, rec, DETAIL_TTL_MS);
      return toDetail(sourceAdId, rec);
    } catch (e) {
      if (
        e instanceof ProviderError &&
        (e.errorClass === "rate-limited" ||
          e.errorClass === "upstream-down" ||
          e.errorClass === "timeout")
      ) {
        const stale = getStale<DivarJson>(cacheKey);
        if (stale) return toDetail(sourceAdId, stale);
      }
      throw e;
    }
  }
}

export const divarProvider: ListingProvider = new FirstPartyDivarProvider();

/**
 * Translate a Shekaar hunt category/city into a provider query.
 * Exported for M4's pipeline; resolves Divar's numeric city id.
 */
export async function toListingQuery(opts: {
  category: string;
  citySlug: string;
  page?: number;
}): Promise<ListingQuery> {
  const categorySlug = CATEGORY_API_VALUE[opts.category] ?? "";
  const cityId =
    opts.citySlug === "all" ? "" : ((await resolveCityId(opts.citySlug)) ?? "");
  return { categorySlug, cityId, keywords: [], page: opts.page ?? 0 };
}
