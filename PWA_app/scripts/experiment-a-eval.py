#!/usr/bin/env python3
"""Experiment A — THE evaluation (Decision v2 sec.1 + sec.5.3 AND +
addendum breakdown). Runs once, after blind grades are complete.

Stage 1 validates grade coverage for every ad in every arm's top-10
and exits WITHOUT printing any metric if coverage is incomplete.
Stage 2 computes Z/G3/G2 per arm, the five sec.1 conditions for
feature-LTR vs control (and vs judge-reorder for the sec.2 hierarchy),
the sec.5.3 AND-condition, the hunt-clustered bootstrap (5,000
resamples, seed fixed), the low/high-spec breakdown, and the sec.5.2
descriptive counts. Verdict per the sec.2 ship hierarchy.
"""
import json, math, sys
import numpy as np

GRADES_PATH = "/home/hatch/workspace/user/files/expa-grades.json"
RANKINGS = "/home/hatch/workspace/experiment-a/rankings.json"
FEATURES = "/home/hatch/workspace/experiment-a/features.json"
POOL = "/home/hatch/workspace/experiment-a/grading-pool.json"
CONTRACTS = "/home/hatch/workspace/your_files/intended-contracts-v1.json"
OUT = "/home/hatch/workspace/experiment-a/eval-report.json"
ORACLE = {3, 6, 9, 12, 15, 18, 21, 24}

blind = json.load(open(GRADES_PATH))["hunts"]
rankings = json.load(open(RANKINGS))["rankings"]
pool = json.load(open(POOL))

# historical grades: pair table with conflict-drop (same rule as model)
feat = json.load(open(FEATURES))
hist, conflicts = {}, set()
for r in feat["train"]:
    k = (r["hunt"], r["adId"])
    if k in hist and hist[k] != r["grade"]:
        conflicts.add(k)
    hist.setdefault(k, r["grade"])
for k in conflicts:
    hist.pop(k, None)


def grade(h, ad):
    b = blind.get(str(h), {}).get(ad)
    if b is not None:
        return b
    return hist.get((h, ad))


# ---------- stage 1: coverage (no metrics)
missing = []
for h in range(1, 25):
    for arm in ("control", "ltr", "judge"):
        for ad in rankings[str(h)][arm]:
            if grade(h, ad) is None:
                missing.append((h, arm, ad))
if missing:
    print(f"COVERAGE FAILURE: {len(missing)} top-10 ads ungraded; "
          f"first: {missing[:5]}")
    sys.exit(2)
blind_count = sum(len(v) for v in blind.values())
print(f"coverage OK | blind grades used: {blind_count} | "
      f"historical reused: "
      f"{sum(1 for h in range(1, 25) for arm in ('control',) for ad in rankings[str(h)][arm] if blind.get(str(h), {}).get(ad) is None)}")

# ---------- stage 2: metrics
def counts(arm, hunts):
    Z = G3 = G2 = 0
    per = {}
    for h in hunts:
        gs = [grade(h, ad) for ad in rankings[str(h)][arm]]
        z = sum(1 for g in gs if g == 0)
        per[h] = z
        Z += z
        G3 += sum(1 for g in gs if g == 3)
        G2 += sum(1 for g in gs if g == 2)
    return Z, G3, G2, per

ALL = list(range(1, 25))
SINGLE = [h for h in ALL if h not in ORACLE]
OR = sorted(ORACLE)
res = {}
for arm in ("control", "ltr", "judge"):
    Z, G3, G2, per = counts(arm, ALL)
    Z16, _, _, _ = counts(arm, SINGLE)
    Z8, _, _, _ = counts(arm, OR)
    res[arm] = {"Z": Z, "G3": G3, "G2": G2, "per": per, "Z16": Z16, "Z8": Z8}


def sec1(arm, base):
    """The five sec.1 conditions for `arm` against baseline `base`,
    plus the sec.5.3 AND-condition (defined vs control only; applied
    for the control comparison, reported separately)."""
    Zb, Za = res[base]["Z"], res[arm]["Z"]
    dz = Zb - Za
    conds = {}
    conds["1_base_has_zeros"] = Zb >= 3
    conds["2_delta_threshold"] = dz >= max(3, math.ceil(0.30 * Zb)) if Zb else False
    worse = [h for h in ALL if res[arm]["per"][h] > res[base]["per"][h]]
    improved = [h for h in ALL if res[arm]["per"][h] < res[base]["per"][h]]
    hunts_with_base_zero = [h for h in ALL if res[base]["per"][h] > 0]
    if len(hunts_with_base_zero) >= 4:
        conds["3_no_worse_and_4_improve"] = (not worse) and len(improved) >= 4
    else:
        conds["3_no_worse_and_4_improve"] = (not worse) and len(improved) >= 2
    conds["4_g3_g2_held"] = (res[arm]["G3"] >= res[base]["G3"]
                             and res[arm]["G2"] >= res[base]["G2"] - 1)
    # hunt-clustered bootstrap on per-hunt zero differences
    diffs = np.array([res[base]["per"][h] - res[arm]["per"][h] for h in ALL],
                     dtype=float)
    rng = np.random.default_rng(20261020)
    boots = np.array([diffs[rng.integers(0, 24, 24)].sum()
                      for _ in range(5000)])
    lo, hi = np.percentile(boots, [5, 95])
    conds["5_bootstrap_ci_above_0"] = bool(lo > 0)
    return {"conds": conds, "pass": all(conds.values()),
            "deltaZ": int(dz), "worse": worse, "improved": improved,
            "bootstrap90": [float(lo), float(hi)]}


cmp_control = sec1("ltr", "control")
cmp_judge = sec1("ltr", "judge")
cmp_judge_vs_control = sec1("judge", "control")

# sec.5.3 AND-condition for LTR vs control
dz16 = res["control"]["Z16"] - res["ltr"]["Z16"]
dz8 = res["control"]["Z8"] - res["ltr"]["Z8"]
and53 = (dz16 >= 1) and (dz16 >= dz8)

# addendum breakdown: specCount = |must| + |mustNot| (+ price/city: none
# in the battery contracts) — median split
contracts = {c["n"]: c for c in json.load(open(CONTRACTS))["hunts"]}
spec = {h: len(contracts[h]["must"]) + len(contracts[h]["mustNot"])
        for h in ALL}
med = float(np.median(list(spec.values())))
breakdown = {}
for name, hs in (("low", [h for h in ALL if spec[h] <= med]),
                 ("high", [h for h in ALL if spec[h] > med])):
    breakdown[name] = {"hunts": hs}
    for arm in ("control", "ltr", "judge"):
        Z, G3, G2, _ = counts(arm, hs)
        breakdown[name][arm] = {"Z": Z, "G3": G3, "G2": G2}

# sec.5.2 descriptive (trigger cannot fire: loss term unobserved)
s52 = {}
for h in OR:
    items = [i for i in pool[str(h)] if i.get("section") == "s52"]
    row = {}
    for side in ("A", "B"):
        gs = [blind.get(str(h), {}).get(i["adId"]) for i in items
              if i.get("poolSide") == side]
        gs = [g for g in gs if g is not None]
        row[side] = {"n": len(gs), "ge2": sum(1 for g in gs if g >= 2),
                     "zero": sum(1 for g in gs if g == 0)}
    s52[h] = row

# sec.2 hierarchy verdict
if not cmp_control["conds"]["1_base_has_zeros"]:
    verdict = "INCONCLUSIVE (sec.1 condition 1: control zeros < 3)"
elif cmp_control["pass"] and not and53:
    verdict = "INCONCLUSIVE (sec.5.3 AND-condition failed)"
elif cmp_control["pass"] and cmp_judge["pass"]:
    verdict = "PASS: feature-LTR passes vs control AND vs judge-reorder -> ship feature-LTR (to sec.7 gate)"
elif cmp_control["pass"]:
    verdict = "PASS vs control, FAIL vs judge-reorder: per sec.2 hierarchy feature-LTR does not ship"
else:
    verdict = "FAIL: feature-LTR does not pass sec.1 -> learned ranking dies for this corpus (sec.2); no second fit"

report = {"arms": res, "ltr_vs_control": cmp_control,
          "ltr_vs_judge": cmp_judge, "judge_vs_control": cmp_judge_vs_control,
          "sec53": {"deltaZ_16": dz16, "deltaZ_8": dz8, "and": and53},
          "breakdown": breakdown, "s52_descriptive": s52,
          "verdict": verdict}
json.dump(report, open(OUT, "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: report[k] for k in
                  ("arms", "sec53", "verdict")}, ensure_ascii=False)[:1200])
print("conds ltr vs control:", cmp_control["conds"],
      "| bootstrap90:", cmp_control["bootstrap90"])
print("conds ltr vs judge:", cmp_judge["conds"])
print("breakdown:", json.dumps(breakdown, ensure_ascii=False)[:500])
print(f"full report -> {OUT}")
