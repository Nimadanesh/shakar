#!/usr/bin/env python3
"""Contract-confirmation human verdict — navid's grades on the contract
packet (laptop battery 2026-10-21, engine 4e73b52, wired contract live).

Grades are ID-keyed (top10) and title-keyed (rejected sample).
Coverage is a hard gate (step-2 harness law): every top-10 ad of
every hunt must carry a grade, else NO numbers are emitted.
Anchors: R11 655/720 Z=20 wrong 33/161 (20%); R12 644/720 Z=19 wrong
11/113 (10%). Caveat (standing): different day, live inventory —
descriptive comparison. If rejected coverage is incomplete the script
still emits the top-10 verdict and lists the ungraded titles.
"""
import json, os, sys

GRADES = "/home/hatch/workspace/user/files/contract-grades.json"
DONE_DIR = "/home/hatch/workspace/battery-contract-in/battery-contract-out/20261021-1124"
CONTRACTS = "/home/hatch/workspace/your_files/intended-contracts-v1.json"
OUT = "/home/hatch/workspace/contract-verdict.json"

queries = {c["n"]: c["query"] for c in json.load(open(CONTRACTS))["hunts"]}
grades = json.load(open(GRADES))["hunts"]


def load_done(fp):
    raw = open(fp, encoding="utf-8-sig").read()
    if raw.lstrip().startswith("data:"):
        for line in raw.splitlines():
            if line.startswith("data: "):
                try:
                    ev = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                if ev.get("type") == "done":
                    return ev
        return None
    return json.loads(raw)


total = Z = G3 = G2 = 0
per_hunt = {}
rej_graded = rej_wrong = 0
rej_wrong_items = []
problems = []
for n in range(1, 25):
    d = load_done(os.path.join(DONE_DIR, f"done-{n}.json"))
    top = (d.get("results") or [])[:10]
    hg = grades.get(str(n), {})
    top_g = hg.get("top10", {})
    if set(top_g.keys()) != {r["sourceAdId"] for r in top}:
        problems.append(f"H{n}: top10 grade coverage mismatch")
        continue
    gs = [top_g[r["sourceAdId"]] for r in top]
    total += sum(gs)
    z = sum(1 for g in gs if g == 0)
    Z += z
    G3 += sum(1 for g in gs if g == 3)
    G2 += sum(1 for g in gs if g == 2)
    per_hunt[n] = {"sum": sum(gs), "Z": z}
    sample = ((d.get("stats") or {}).get("rejectedSample") or [])
    graded_rej = hg.get("rejected", [])
    if len(graded_rej) != len(sample):
        problems.append(f"H{n}: rejected graded {len(graded_rej)} != sample {len(sample)}")
    by_title = {}
    for item in graded_rej:
        by_title.setdefault(item["title"], []).append(item["grade"])
    for s in sample:
        g = (by_title.get(s["title"]) or [None]).pop(0)
        if g is None:
            problems.append(f"H{n}: rejected title ungraded: {s['title'][:40]}")
            continue
        rej_graded += 1
        if g >= 2:
            rej_wrong += 1
            rej_wrong_items.append({"hunt": n, "query": queries[n],
                                    "title": s["title"], "grade": g,
                                    "kind": s.get("kind", "")})

top_problems = [p for p in problems if "top10" in p]
rej_problems = [p for p in problems if "top10" not in p]
if top_problems:
    print("HARNESS GATE FAILED (top-10 coverage) — no verdict emitted:")
    for p in top_problems:
        print(" -", p)
    sys.exit(2)
if rej_problems:
    print("rejected-section coverage gaps (verdict proceeds on graded subset):")
    for p in rej_problems:
        print(" -", p)

report = {
    "engine": "4e73b52 (contract wired, laptop battery 2026-10-21)",
    "total": total, "max": 720, "Z": Z, "G3": G3, "G2": G2,
    "perHunt": per_hunt,
    "rejectedAudit": {"graded": rej_graded, "wrong_ge2": rej_wrong,
                      "wrongRate": round(rej_wrong / rej_graded, 3) if rej_graded else None,
                      "items": rej_wrong_items},
    "anchors": {"R11": {"total": 655, "Z": 20, "rejectedWrong": "33/161 (20%)"}, "R12": {"total": 644, "Z": 19, "rejectedWrong": "11/113 (10%)"}},
}
json.dump(report, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"CONTRACT VERDICT: total {total}/720 | Z {Z} | G3 {G3} | G2 {G2}")
print(f"rejected audit: {rej_wrong}/{rej_graded} wrong "
      f"({report['rejectedAudit']['wrongRate']:.0%})")
worst = sorted(per_hunt.items(), key=lambda kv: -kv[1]["Z"])[:5]
print("worst hunts by zeros:", [(f"H{n}", v["Z"], v["sum"]) for n, v in worst])
print(f"report -> {OUT}")
