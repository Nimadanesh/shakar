#!/usr/bin/env python3
"""Experiment A — extend the blind grading pool with the sec.5.2
symmetric-difference sample (same pool, same blind pass, per sec.8.6):
per oracle hunt, up to 10 B-only + 10 A-only pool ads not already in
the arm-top-10 union, fixed-seed sample, tagged section="s52".

Recorded limitation: Snapshot v1 captured oracle hunts at A50/B50 only,
so the A51-100 counterfactual ("lost by cutting A to 50") is unobserved;
the sec.5.2 trigger's loss term cannot be measured from this snapshot
and expansion therefore cannot fire on it (decision-faithful default:
shut). These grades are still collected for the descriptive comparison.
"""
import json, random

POOL_PATH = "/home/hatch/workspace/experiment-a/grading-pool.json"
POOLS = "/home/hatch/workspace/snapshot-v1/pools-full.json"
ORACLE = [3, 6, 9, 12, 15, 18, 21, 24]

pool = json.load(open(POOL_PATH))
pools = json.load(open(POOLS, encoding="utf-8-sig"))
added = 0
for h in ORACLE:
    have = {i["adId"] for i in pool[str(h)]}
    for i in pool[str(h)]:
        i.setdefault("section", "expA")
    ads = pools[str(h)]
    b_only = [a for a in ads if a.get("poolSide") == "B" and a["sourceAdId"] not in have]
    a_only = [a for a in ads if a.get("poolSide") == "A" and a["sourceAdId"] not in have]
    rng = random.Random(5000 + h)
    rng.shuffle(b_only)
    rng.shuffle(a_only)
    extra = []
    for a in b_only[:10] + a_only[:10]:
        extra.append({"adId": a["sourceAdId"], "title": a["title"],
                      "desc": a.get("descSnippet", ""), "price": a.get("price"),
                      "city": a.get("city", ""), "poolSide": a.get("poolSide"),
                      "section": "s52"})
    rng.shuffle(extra)
    pool[str(h)].extend(extra)
    added += len(extra)
json.dump(pool, open(POOL_PATH, "w"), ensure_ascii=False)
total = sum(len(v) for v in pool.values())
print(f"s52 sample added: {added} | total blind pool: {total}")
