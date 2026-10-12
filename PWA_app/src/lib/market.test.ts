import { describe, expect, it } from "vitest";
import { extractEconomicNews, extractPrices, extractSpark } from "./market";

describe("extractPrices", () => {
  it("pulls the five wanted symbols in navid's display order", () => {
    const payload = {
      data: {
        categories: {
          currency: [
            { symbol: "EUR_IRR_FREE", price: 294220, change_pct: -0.98, timestamp_jalali: "1405/07/20 18:13:31" },
            { symbol: "USD_IRR_FREE", price: 262780, change_pct: -0.58, timestamp_jalali: "1405/07/20 18:13:30" },
            { symbol: "AED_IRR_FREE", price: 71698, change_pct: -1.13, timestamp_jalali: "1405/07/20 18:13:31" },
            { symbol: "GBP_IRR_FREE", price: 350000, change_pct: 0.1, timestamp_jalali: "1405/07/20 18:13:31" },
          ],
          coin: [
            { symbol: "COIN_HALF_IRR", price: 139880000, change_pct: -0.9, timestamp_jalali: "1405/07/20 18:13:30" },
            { symbol: "COIN_EMAMI_IRR", price: 264565000, change_pct: -1.02, timestamp_jalali: "1405/07/20 18:13:30" },
          ],
        },
      },
    };
    const out = extractPrices(payload);
    expect(out.map((p) => p.symbol)).toEqual([
      "USD_IRR_FREE",
      "EUR_IRR_FREE",
      "AED_IRR_FREE",
      "COIN_EMAMI_IRR",
      "COIN_HALF_IRR",
    ]);
    expect(out[0]).toMatchObject({ name: "دلار آمریکا", price: 262780, changePct: -0.58 });
    expect(out[3]).toMatchObject({ name: "سکه امامی", price: 264565000 });
  });

  it("skips records with a missing or non-numeric price, nulls bad change_pct", () => {
    const payload = {
      data: {
        categories: {
          currency: [
            { symbol: "USD_IRR_FREE", price: null, change_pct: -0.5 },
            { symbol: "EUR_IRR_FREE", price: 294220, change_pct: "bad" },
          ],
        },
      },
    };
    const out = extractPrices(payload);
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe("EUR_IRR_FREE");
    expect(out[0].changePct).toBeNull();
  });

  it("returns [] for garbage payloads instead of throwing", () => {
    expect(extractPrices(null)).toEqual([]);
    expect(extractPrices({})).toEqual([]);
    expect(extractPrices({ data: { categories: null } })).toEqual([]);
  });
});

describe("extractSpark", () => {
  it("returns the last n finite closes, oldest → newest", () => {
    const payload = {
      data: [
        { close: 100 },
        { close: null },
        { close: 102 },
        { close: "x" },
        { close: 101 },
        { close: 103 },
      ],
    };
    expect(extractSpark(payload, 3)).toEqual([102, 101, 103]);
  });

  it("returns [] when there is no usable history", () => {
    expect(extractSpark(null)).toEqual([]);
    expect(extractSpark({ data: "nope" })).toEqual([]);
    expect(extractSpark({ data: [{ close: null }] })).toEqual([]);
  });
});

describe("extractEconomicNews", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<item><title><![CDATA[قیمت دلار، یورو و درهم امروز]]></title><link>https://donya-e-eqtesad.com/a1</link></item>
<item><title><![CDATA[حملات شدید عربستان به یمن]]></title><link>https://donya-e-eqtesad.com/a2</link></item>
<item><title><![CDATA[قیمت طلا و سکه امروز]]></title><link>https://donya-e-eqtesad.com/a3</link></item>
</channel></rss>`;

  it("keeps market-moving headlines and drops the rest", () => {
    const out = extractEconomicNews(xml, 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      title: "قیمت دلار، یورو و درهم امروز",
      link: "https://donya-e-eqtesad.com/a1",
    });
    expect(out[1].title).toContain("طلا و سکه");
  });

  it("respects the limit", () => {
    expect(extractEconomicNews(xml, 1)).toHaveLength(1);
  });

  it("ranks price roundups above other economic headlines", () => {
    const mixed = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<item><title><![CDATA[نوبل امسال نشان می‌دهد تصمیم‌های ما اقتصاد را می‌سازد]]></title><link>https://donya-e-eqtesad.com/b1</link></item>
<item><title><![CDATA[قیمت دلار، یورو و درهم امروز]]></title><link>https://donya-e-eqtesad.com/b2</link></item>
</channel></rss>`;
    const out = extractEconomicNews(mixed, 10);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("قیمت دلار، یورو و درهم امروز");
  });
});
