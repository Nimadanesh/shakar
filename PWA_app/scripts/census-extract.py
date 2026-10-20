#!/usr/bin/env python3
"""
Census of top-10 grade-0s — Decision v2 sec.4 (extraction step).

For every round with complete data (done files + founder grades),
join grades to results by packet order (grades[i] -> results[i],
the same validated join as grades-to-idkeyed.py), keep only hunts
whose 10 grades are all present and non-null, and extract every
top-10 grade-0 ad with its labeling context.

Output: census-worksheet.json — one row per zero:
  round, hunt n, query, rank, adId, title, price, city, descSnippet,
  matchKind, evidence, missingInfo, mizan (shadow judgment if any).

Inclusion/exclusion is logged to stdout — nothing is dropped silently.
"""
import json
import os
import sys

ROUNDS = [
    ("R7", "/home/hatch/workspace/user/files/r7-out/20261018-0024",
     "/home/hatch/workspace/user/files/r7-grades-4b18ae5-corrected.json"),
    ("R8", "/home/hatch/workspace/r8-laptop-out/r8-laptop-out/20261019-0717",
     "/home/hatch/workspace/user/files/r8-grades-ceafe05.json"),
    ("R9", "/home/hatch/workspace/r9-laptop-out/20261019-2307",
     "/home/hatch/workspace/user/files/r9-grades-948a202.json"),
    ("R10", "/home/hatch/workspace/r10-vm-out/20261020-0146",
     "/home/hatch/workspace/user/files/r9-grades-5a1fc7f.json"),  # R10 grades (engine 5a1fc7f, total 647)
    ("R11", "/home/hatch/workspace/r11-vm-out",
     "/home/hatch/workspace/user/files/r11-grades-2f17edc.json"),
]

CANONICAL = {
    1: "تعمیرات تخصصی موبایل", 2: "نصاب کولر گازی می‌خوام", 3: "خریدار پراید",
    4: "پراید", 5: "فروشنده پراید", 6: "پراید ۱۳۱ مدل ۹۸", 7: "ماشین بدون رنگ",
    8: "بادوم زمینی", 9: "ماشین لباسشویی", 10: "آیفون ۱۳ پرو", 11: "آیفون بدون خط و خش",
    12: "ماشین بدون تصادف", 13: "مبل بدون لکه", 14: "باطری ماشین", 15: "قاب آیفون ۱۳",
    16: "وانت پراید", 17: "تعمیرکار یخچال میخوام", 18: "آپارتمان بدون وام",
    19: "دستگاه جوجه کشی", 20: "کره بادوم زمینی", 21: "آموزش تعمیرات موبایل",
    22: "پودر لباسشویی", 23: "یخچال", 24: "موتور سیکلت",
}


def load_done(path):
    raw = open(path, encoding="utf-8-sig").read()
    if raw.lstrip().startswith("data:"):
        for line in raw.splitlines():
            if line.startswith("data: "):
                try:
                    d = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                if d.get("type") == "done":
                    return d
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def main():
    rows = []
    for rnd, done_dir, grades_path in ROUNDS:
        grades = json.load(open(grades_path, encoding="utf-8-sig"))["hunts"]
        inc = exc = zeros = 0
        for h in grades:
            n = h["n"]
            g = h.get("grades") or []
            if len(g) != 10 or any(x is None for x in g):
                exc += 1
                print(f"{rnd} H{n}: EXCLUDED (grades incomplete: {len(g)} entries)")
                continue
            if h.get("query") != CANONICAL.get(n):
                print(f"{rnd} H{n}: WARNING query mismatch: {h.get('query')!r} vs canonical {CANONICAL.get(n)!r}")
            fp = os.path.join(done_dir, f"done-{n}.json")
            if not os.path.exists(fp):
                exc += 1
                print(f"{rnd} H{n}: EXCLUDED (no done file)")
                continue
            d = load_done(fp)
            results = (d or {}).get("results") or []
            if len(results) < 10:
                exc += 1
                print(f"{rnd} H{n}: EXCLUDED (only {len(results)} results)")
                continue
            ids = [r.get("sourceAdId") for r in results[:10]]
            if len(set(ids)) != 10:
                exc += 1
                print(f"{rnd} H{n}: EXCLUDED (duplicate top-10 IDs)")
                continue
            shadow = {}
            for s in ((d.get("stats") or {}).get("mizanShadow") or []):
                shadow[s.get("title")] = s.get("judgment")
            inc += 1
            for i, grade in enumerate(g):
                if grade != 0:
                    continue
                r = results[i]
                zeros += 1
                rows.append({
                    "round": rnd, "hunt": n, "query": h.get("query"),
                    "rank": i + 1, "adId": r.get("sourceAdId"),
                    "title": r.get("title"), "price": r.get("price"),
                    "priceText": r.get("priceText"), "city": r.get("city"),
                    "descSnippet": (r.get("descSnippet") or "")[:200],
                    "matchKind": r.get("matchKind"), "evidence": r.get("evidence"),
                    "missingInfo": r.get("missingInfo"),
                    "mizan": shadow.get(r.get("title")),
                })
        print(f"{rnd}: hunts included {inc}, excluded {exc}, top-10 zeros {zeros}")
    out = "/home/hatch/workspace/census-worksheet.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print(f"\nTOTAL zeros extracted: {len(rows)} -> {out}")


if __name__ == "__main__":
    main()
