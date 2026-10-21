#!/usr/bin/env python3
"""Extract every (hunt, ad) the founder graded >=2 from R7-R11 top-10s
(packet-order join, validated by the harness gate) for the sec.6
'deletes 0 graded >=2' audit of the wired intent contract."""
import importlib.util, json, os
spec = importlib.util.spec_from_file_location(
    "census_extract",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "census-extract.py"))
ce = importlib.util.module_from_spec(spec); spec.loader.exec_module(ce)
rows, seen = [], set()
for rnd, done_dir, grades_path in ce.ROUNDS:
    grades = json.load(open(grades_path, encoding="utf-8-sig"))["hunts"]
    for h in grades:
        n, g = h["n"], h.get("grades") or []
        if len(g) != 10 or any(x is None for x in g): continue
        fp = os.path.join(done_dir, f"done-{n}.json")
        if not os.path.exists(fp): continue
        results = (ce.load_done(fp) or {}).get("results") or []
        if len(results) < 10: continue
        for i, grade in enumerate(g):
            if grade >= 2:
                r = results[i]
                key = (n, r["sourceAdId"])
                if key in seen: continue
                seen.add(key)
                rows.append({"hunt": n, "query": ce.CANONICAL[n], "round": rnd,
                             "adId": r["sourceAdId"], "grade": grade,
                             "title": r.get("title", ""), "desc": r.get("descSnippet", "")})
out = "/home/hatch/workspace/ge2-ads.json"
json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(rows)} unique (hunt, ad) pairs graded >=2 -> {out}")
