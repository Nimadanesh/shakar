#!/usr/bin/env python3
"""Experiment A harness, step 1: assemble full Snapshot v1 pools.

Pool per hunt (manifest): the run's full results list; oracle hunts
(3,6,9,12,15,18,21,24) = A(cap50) results then B(cap50), deduped by
sourceAdId (A wins). Each ad carries its Mizan shadow judgment when the
hunt's stats.mizanShadow has an entry with the same title (title-keyed
in the payload; collisions counted and reported).
Out: ~/workspace/snapshot-v1/pools-full.json
"""
import json, os
from collections import Counter

BASE = "/home/hatch/workspace/snapshot-v1/laptop/snapshot-v1-laptop-out/20261020-2023"
ORACLE = {3, 6, 9, 12, 15, 18, 21, 24}


def load_done(name):
    p = os.path.join(BASE, name)
    return json.load(open(p, encoding="utf-8-sig")) if os.path.exists(p) else None


def attach_judgments(results, shadow):
    by_title = {}
    for j in shadow or []:
        by_title.setdefault(j.get("title", ""), []).append(j)
    used = Counter()
    collisions = 0
    for r in results:
        cands = by_title.get(r.get("title", ""), [])
        k = used[r.get("title", "")]
        if k < len(cands):
            r["judgment"] = cands[k]
            used[r.get("title", "")] += 1
            if len(cands) > 1:
                collisions += 1
    return collisions


pools, report = {}, {}
for n in range(1, 25):
    if n in ORACLE:
        a, b = load_done(f"done-{n}a.json"), load_done(f"done-{n}b.json")
        seen, results = set(), []
        for src, d in (("A", a), ("B", b)):
            for r in (d or {}).get("results", []):
                if r["sourceAdId"] not in seen:
                    seen.add(r["sourceAdId"])
                    r = dict(r)
                    r["poolSide"] = src
                    results.append(r)
        shadow = ((a or {}).get("stats", {}).get("mizanShadow") or []) + \
                 ((b or {}).get("stats", {}).get("mizanShadow") or [])
    else:
        d = load_done(f"done-{n}.json")
        results = [dict(r, poolSide="S") for r in (d or {}).get("results", [])]
        shadow = (d or {}).get("stats", {}).get("mizanShadow") or []
    col = attach_judgments(results, shadow)
    pools[str(n)] = results
    report[n] = {"pool": len(results),
                 "judged": sum(1 for r in results if r.get("judgment")),
                 "titleCollisions": col}

out = "/home/hatch/workspace/snapshot-v1/pools-full.json"
json.dump(pools, open(out, "w", encoding="utf-8"), ensure_ascii=False)
tot_j = sum(v["judged"] for v in report.values())
tot = sum(v["pool"] for v in report.values())
kinds = Counter()
for ads in pools.values():
    for a in ads:
        if a.get("judgment"):
            kinds[a["judgment"].get("kind", "?")] += 1
print(f"pools: {tot} ads | judged {tot_j} | -> {out}")
print("kind vocabulary:", dict(kinds.most_common()))
print("collisions total:", sum(v["titleCollisions"] for v in report.values()))
