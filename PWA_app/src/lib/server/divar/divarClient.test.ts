import { afterEach, describe, expect, it, vi } from "vitest";

function listJson() {
  return {
    list_widgets: [
      {
        widget_type: "POST_ROW",
        data: {
          title: "آپارتمان ۸۰ متری",
          action: {
            payload: {
              token: "tok123",
              web_info: {
                title: "آپارتمان ۸۰ متری",
                district_persian: "سعادت‌آباد",
                city_persian: "تهران",
              },
            },
          },
          image_url: "https://example.com/img.webp",
          middle_description_text: "۸۰۰,۰۰۰,۰۰۰ تومان",
          bottom_description_text: "در سعادت‌آباد",
        },
      },
      {
        widget_type: "POST_ROW",
        data: {
          title: "آپارتمان توافقی",
          action: {
            payload: {
              token: "tok456",
              web_info: { title: "آپارتمان توافقی", city_persian: "تهران" },
            },
          },
          middle_description_text: "توافقی",
        },
      },
      { widget_type: "BANNER", data: {} },
    ],
    pagination: { has_next_page: true, data: { last_post_date: "x" } },
  };
}

function detailJson() {
  return {
    city: "تهران",
    sections: [
      {
        section_name: "TITLE",
        widgets: [{ widget_type: "LEGEND_TITLE_ROW", data: { text: "آپارتمان ۸۰ متری" } }],
      },
      {
        section_name: "DESCRIPTION",
        widgets: [{ widget_type: "DESCRIPTION_ROW", data: { text: "توضیح کامل آگهی" } }],
      },
      {
        section_name: "LIST_DATA",
        widgets: [
          {
            widget_type: "UNEXPANDABLE_ROW",
            data: { title: "قیمت کل", value: "۸۰۰,۰۰۰,۰۰۰ تومان" },
          },
        ],
      },
      {
        section_name: "BREADCRUMB",
        widgets: [
          {
            widget_type: "BREADCRUMB",
            data: {
              parent_items: [
                {
                  action: {
                    payload: {
                      search_data: {
                        form_data: { data: { category: { str: { value: "apartment-sell" } } } },
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function mockFetch(handler: (url: string, init: { method?: string; body?: string }) => unknown) {
  const calls: Array<{ url: string; init: { method?: string; body?: string } }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { method?: string; body?: string }) => {
      calls.push({ url, init });
      return handler(url, init);
    })
  );
  return calls;
}

const okJson = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("FirstPartyDivarProvider", () => {
  it("strips list payloads to the UI fields and parses Persian prices", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    const res = await divarProvider.searchLists({
      categorySlug: "apartment-sell",
      cityId: "1",
      keywords: [],
      page: 0,
    });
    expect(res.listings).toHaveLength(2);
    expect(res.listings[0]).toEqual({
      sourceAdId: "tok123",
      title: "آپارتمان ۸۰ متری",
      price: 800000000,
      priceText: "۸۰۰,۰۰۰,۰۰۰ تومان",
      city: "تهران",
      district: "سعادت‌آباد",
      thumbnail: "https://example.com/img.webp",
    });
    // «توافقی» → null price, never 0; raw payload fields never leak.
    expect(res.listings[1].price).toBeNull();
    expect(res.listings[1]).not.toHaveProperty("action");
    expect(res.hasMore).toBe(true);
    expect(calls).toHaveLength(1);
    const sent = JSON.parse(calls[0].init.body ?? "{}");
    expect(sent.city_ids).toEqual(["1"]);
    expect(sent.search_data.form_data.data.category.str.value).toBe(
      "apartment-sell"
    );
  });

  it("sends keywords as the API text query (flaw #11)", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    await divarProvider.searchLists({
      categorySlug: "",
      cityId: "1",
      keywords: ["آپارتمان", "نوساز"],
      page: 0,
    });
    const sentBody = JSON.parse(String(calls[0].init.body ?? "{}"));
    expect(
      sentBody.search_data.form_data.data.query.str.value
    ).toBe("آپارتمان نوساز");
  });

  it("omits the text query when there are no keywords", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    await divarProvider.searchLists({
      categorySlug: "",
      cityId: "1",
      keywords: [],
      page: 0,
    });
    const sentBody = JSON.parse(String(calls[0].init.body ?? "{}"));
    expect(sentBody.search_data.form_data.data.query).toBeUndefined();
  });

  it("extracts detail description, price and category", async () => {
    mockFetch(() => okJson(detailJson()));
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    const d = await divarProvider.getDetail("tok123");
    expect(d.description).toBe("توضیح کامل آگهی");
    expect(d.price).toBe(800000000);
    expect(d.title).toBe("آپارتمان ۸۰ متری");
    expect(d.categorySlug).toBe("apartment-sell");
  });

  it("caches list responses (second call hits no network)", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    const q = { categorySlug: "apartment-sell", cityId: "1", keywords: [], page: 0 };
    await divarProvider.searchLists(q);
    await divarProvider.searchLists(q);
    expect(calls).toHaveLength(1);
  });

  it("maps 429 to rate-limited with NO retry", async () => {
    const calls = mockFetch(() => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response);
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    await expect(
      divarProvider.searchLists({ categorySlug: "x", cityId: "1", keywords: [], page: 9 })
    ).rejects.toMatchObject({ errorClass: "rate-limited" });
    expect(calls).toHaveLength(1); // never spin-retry against the quota
  });

  it("retries once on 5xx, then throws", async () => {
    const calls = mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response);
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    await expect(
      divarProvider.searchLists({ categorySlug: "x", cityId: "1", keywords: [], page: 8 })
    ).rejects.toMatchObject({ errorClass: "upstream-down" });
    expect(calls).toHaveLength(2);
  });
});

describe("taxonomy", () => {
  it("covers every app category", async () => {
    const { CATEGORY_API_VALUE } = await import("./taxonomy");
    for (const c of ["all", "vehicles", "real-estate", "music", "mobile", "home"]) {
      expect(c in CATEGORY_API_VALUE).toBe(true);
    }
    expect(CATEGORY_API_VALUE["real-estate"]).toBe("real-estate");
  });

  it("resolves Tehran's slug to id 1 and caches the city list", async () => {
    const calls = mockFetch((url: string) => {
      if (url.includes("/places/cities"))
        return okJson({ cities: [{ id: 1, slug: "tehran" }, { id: 2, slug: "karaj" }] });
      return okJson(listJson());
    });
    const { resolveCityId } = await import("./taxonomy");
    const { clearCache } = await import("./cache");
    clearCache();
    expect(await resolveCityId("tehran")).toBe("1");
    expect(await resolveCityId("karaj")).toBe("2");
    expect(await resolveCityId("unknown")).toBeNull();
    expect(calls.filter((c) => c.url.includes("/places/cities"))).toHaveLength(1);
  });
});

describe("ip health", () => {
  it("counts outcomes", async () => {
    mockFetch(() => okJson(listJson()));
    const { divarFetch, getIpHealth } = await import("./throttle");
    const { clearCache } = await import("./cache");
    clearCache();
    const before = getIpHealth().total;
    await divarFetch("https://api.divar.ir/v8/postlist/w/search", {
      method: "POST",
      body: {},
      kind: "meta",
    });
    const after = getIpHealth();
    expect(after.total).toBe(before + 1);
    expect(after.ok).toBeGreaterThan(0);
  });
});

describe("anti-footprint hardening", () => {
  it("429 triggers a cooldown: the next request fails fast without network", async () => {
    const calls = mockFetch(
      () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response
    );
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    const q = { categorySlug: "apartment-sell", cityId: "1", keywords: [], page: 7 };
    await expect(divarProvider.searchLists(q)).rejects.toMatchObject({
      errorClass: "rate-limited",
    });
    // A second hunt during the cooldown never touches the network.
    await expect(
      divarProvider.searchLists({ ...q, page: 8 })
    ).rejects.toMatchObject({ errorClass: "rate-limited" });
    expect(calls).toHaveLength(1);
  });

  it("opens the circuit after 5 consecutive failures", async () => {
    const calls = mockFetch(
      () => ({ ok: false, status: 403, json: async () => ({}) }) as unknown as Response
    );
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    for (let page = 0; page < 5; page++) {
      await expect(
        divarProvider.searchLists({ categorySlug: "apartment-sell", cityId: "1", keywords: [], page })
      ).rejects.toMatchObject({ errorClass: "upstream-down" });
    }
    expect(calls).toHaveLength(5);
    // 6th fails fast — the ban is a normal state, not a retry storm.
    await expect(
      divarProvider.searchLists({ categorySlug: "apartment-sell", cityId: "1", keywords: [], page: 99 })
    ).rejects.toThrow("circuit open");
    expect(calls).toHaveLength(5);
  }, 30000);

  it("serves stale cache during a restriction, flagged honestly", async () => {
    const calls = mockFetch(
      () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response
    );
    const { divarProvider } = await import("./divarClient");
    const { clearCache, setCached } = await import("./cache");
    clearCache();
    // Seed an EXPIRED entry — getCached skips it, getStale serves it.
    // Key format: list:{cityId}:{category}:{queryText}:{page}.
    setCached("list:1:apartment-sell::0", listJson(), -1);
    const res = await divarProvider.searchLists({
      categorySlug: "apartment-sell",
      cityId: "1",
      keywords: [],
      page: 0,
    });
    expect(res.stale).toBe(true);
    expect(res.hasMore).toBe(false);
    expect(res.listings).toHaveLength(2);
    expect(calls).toHaveLength(1); // one live attempt, then stale
  });

  it("throws honestly when restricted with no stale cache", async () => {
    mockFetch(
      () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response
    );
    const { divarProvider } = await import("./divarClient");
    const { clearCache } = await import("./cache");
    clearCache();
    await expect(
      divarProvider.searchLists({ categorySlug: "apartment-sell", cityId: "1", keywords: [], page: 3 })
    ).rejects.toMatchObject({ errorClass: "rate-limited" });
  });

  it("exposes cooldown state in IP health", async () => {
    mockFetch(
      () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response
    );
    const { divarProvider } = await import("./divarClient");
    const { getIpHealth } = await import("./throttle");
    const { clearCache } = await import("./cache");
    clearCache();
    await expect(
      divarProvider.searchLists({ categorySlug: "apartment-sell", cityId: "1", keywords: [], page: 4 })
    ).rejects.toBeDefined();
    const h = getIpHealth();
    expect(h.rateLimited429).toBe(1);
    expect(h.coolingDownUntil).not.toBeNull();
    expect(h.consecutiveFailures).toBe(1);
  });
});

describe("in-flight coalescing (quality-neutral)", () => {
  it("3 simultaneous identical requests = 1 network call, same complete response", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarFetch } = await import("./throttle");
    const url = "https://api.divar.ir/v8/postlist/w/search";
    const args = { method: "POST" as const, body: { city_ids: ["1"] }, kind: "list" as const };
    const [a, b, c] = await Promise.all([
      divarFetch(url, args),
      divarFetch(url, args),
      divarFetch(url, args),
    ]);
    expect(calls).toHaveLength(1);
    // Identical response object — nothing sampled, nothing truncated.
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("never merges different request bodies (pagination stays separate)", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarFetch } = await import("./throttle");
    const url = "https://api.divar.ir/v8/postlist/w/search";
    await Promise.all([
      divarFetch(url, { method: "POST", body: { page: 1 }, kind: "list" }),
      divarFetch(url, { method: "POST", body: { page: 2 }, kind: "list" }),
    ]);
    expect(calls).toHaveLength(2);
  });

  it("releases the slot after settlement — later calls fetch fresh", async () => {
    const calls = mockFetch(() => okJson(listJson()));
    const { divarFetch } = await import("./throttle");
    const url = "https://api.divar.ir/v8/postlist/w/search";
    const args = { method: "POST" as const, body: { x: 1 }, kind: "list" as const };
    await divarFetch(url, args);
    await divarFetch(url, args);
    expect(calls).toHaveLength(2);
  });
});
