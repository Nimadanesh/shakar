#!/usr/bin/env python3
"""
Snapshot v1 freeze — Decision v2 sec.5.1 + sec.5.3 (2026-10-20).

Freezes, BEFORE any snapshot fetch:
  1. The per-hunt ID list of historical grade >= 2 ads (top-10 grades
     from R7-R11, joined to ad IDs by the validated packet-order join).
     After the snapshot fetch, the re-find rate = fraction of these IDs
     present in the snapshot pools (sec.5.1: >=90% healthy, <70% flag,
     gates nothing).
  2. The 8 oracle hunts by FIXED POSITION rule (every 3rd hunt:
     3, 6, 9, 12, 15, 18, 21, 24) — chosen blind to census outcomes —
     and their subject-anchored B queries for the 50/50 dual-query
     split (sec.5.2).

Output: ~/workspace/snapshot-v1/manifest.json
"""
import importlib.util
import json
import os

spec = importlib.util.spec_from_file_location(
    "census_extract",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "census-extract.py"),
)
ce = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ce)

ORACLE_POSITIONS = [3, 6, 9, 12, 15, 18, 21, 24]
B_QUERIES = {
    3: "پراید",            # خریدار پراید -> subject only
    6: "پراید ۱۳۱",         # پراید ۱۳۱ مدل ۹۸ -> drop year constraint
    9: "لباسشویی",          # ماشین لباسشویی -> short subject form
    12: "ماشین",            # ماشین بدون تصادف -> subject only, absence dropped
    15: "قاب آیفون",        # قاب آیفون ۱۳ -> drop model number
    18: "آپارتمان",         # آپارتمان بدون وام -> subject only
    21: "تعمیرات موبایل",   # آموزش تعمیرات موبایل -> drop training frame
    24: "موتور",            # موتور سیکلت -> short subject form
}


def main():
    per_hunt = {}
    for rnd, done_dir, grades_path in ce.ROUNDS:
        grades = json.load(open(grades_path, encoding="utf-8-sig"))["hunts"]
        for h in grades:
            n = h["n"]
            g = h.get("grades") or []
            if len(g) != 10 or any(x is None for x in g):
                continue
            fp = os.path.join(done_dir, f"done-{n}.json")
            if not os.path.exists(fp):
                continue
            d = ce.load_done(fp)
            results = (d or {}).get("results") or []
            if len(results) < 10:
                continue
            for i, grade in enumerate(g):
                if grade >= 2:
                    per_hunt.setdefault(n, {})[results[i]["sourceAdId"]] = grade
    frozen = {str(n): sorted(ids.keys()) for n, ids in sorted(per_hunt.items())}
    total = sum(len(v) for v in frozen.values())
    manifest = {
        "snapshot": "v1",
        "frozenAt": "2026-10-20 (before any snapshot fetch)",
        "ge2IdsByHunt": frozen,
        "ge2Total": total,
        "oracleRule": "fixed positions in the 24-hunt list (every 3rd), chosen blind to census outcomes",
        "oracleHunts": ORACLE_POSITIONS,
        "bQueries": {str(k): v for k, v in B_QUERIES.items()},
        "oracleQueries": {str(n): ce.CANONICAL[n] for n in ORACLE_POSITIONS},
        "poolDefinition": "full results list of the snapshot run; oracle hunts: A(cap 50) union B(cap 50), dedup by sourceAdId, A order first",
        "knownLimitation": "ads the deterministic layer rejects beyond the 12-entry rejectedSample are not in the pool; Experiment A measures ranking on the surviving pool",
    }
    out_dir = "/home/hatch/workspace/snapshot-v1"
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "manifest.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"froze {total} grade>=2 ad IDs across {len(frozen)} hunts -> {out}")
    print(f"oracle hunts: {ORACLE_POSITIONS}")
    for n in ORACLE_POSITIONS:
        print(f"  H{n}: A={ce.CANONICAL[n]!r}  B={B_QUERIES[n]!r}")


if __name__ == "__main__":
    main()
