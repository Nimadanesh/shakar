#!/usr/bin/env python3
"""R12 human verdict — from navid's grades on the late packet.

Grades are ID-keyed (top10) and title-keyed (rejected sample).
Coverage is a hard gate (step-2 harness law): every top-10 ad of
every hunt must carry a grade, else NO numbers are emitted.
Anchors: R11 verdict 655/720, Z=20, rejected audit 33/161 wrong (20%).
Caveat (standing): different day, live inventory — descriptive
comparison, and the R12 battery ran on the VM (~7 judgments/hunt).
"""
import json, os, sys

GRADES = "/home/hatch/workspace/user/files/r12-grades.json"
DONE_DIR = "/home/hatch/workspace/r12-vm-out"
CONTRACTS = "/home/hatch/workspace/your_files/intended-contracts-v1.json"
OUT = "/home/hatch/workspace/r12-verdict.json"

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

if problems:
    print("HARNESS GATE FAILED — no verdict emitted:")
    for p in problems:
        print(" -", p)
    sys.exit(2)

report = {
    "engine": "61f4a1b (R12b, VM battery 2026-10-20)",
    "total": total, "max": 720, "Z": Z, "G3": G3, "G2": G2,
    "perHunt": per_hunt,
    "rejectedAudit": {"graded": rej_graded, "wrong_ge2": rej_wrong,
                      "wrongRate": round(rej_wrong / rej_graded, 3) if rej_graded else None,
                      "items": rej_wrong_items},
    "anchors": {"R11": {"total": 655, "Z": 20, "rejectedWrong": "33/161 (20%)"}},
}
json.dump(report, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"R12 VERDICT: total {total}/720 | Z {Z} | G3 {G3} | G2 {G2}")
print(f"rejected audit: {rej_wrong}/{rej_graded} wrong "
      f"({report['rejectedAudit']['wrongRate']:.0%})")
worst = sorted(per_hunt.items(), key=lambda kv: -kv[1]["Z"])[:5]
print("worst hunts by zeros:", [(f"H{n}", v["Z"], v["sum"]) for n, v in worst])
print(f"report -> {OUT}")
