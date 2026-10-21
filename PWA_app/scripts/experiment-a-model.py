#!/usr/bin/env python3
"""Experiment A — the ONE pre-registered run (Decision v2 sec.1-2, 5.3).

LOHO over the 24 hunts. Arms: control (snapshot order), feature-LTR
(GBDT depth<=3 vs Ridge on the inner split; winner refit on 23 hunts),
judge-reorder (stable partition: Mizan would-reject ads to the bottom).
Writes rankings + the blind grading pool (union of arm top-10s minus
historically graded pairs). NO evaluation happens here — evaluation
runs once, after the founder grades the pool blind.
"""
import json, math, random
from collections import defaultdict
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge

FEAT = "/home/hatch/workspace/experiment-a/features.json"
POOLS = "/home/hatch/workspace/snapshot-v1/pools-full.json"
OUT_RANK = "/home/hatch/workspace/experiment-a/rankings.json"
OUT_POOL = "/home/hatch/workspace/experiment-a/grading-pool.json"
ROUND_ORDER = {"R7": 0, "R8": 1, "R9": 2, "R10": 3, "R11": 4}

d = json.load(open(FEAT))
pools = json.load(open(POOLS, encoding="utf-8-sig"))

# ---- pair table: dedupe (hunt, ad); conflicts dropped; latest round wins
pairs = {}
conflicts = set()
for r in d["train"]:
    k = (r["hunt"], r["adId"])
    if k in pairs and pairs[k]["grade"] != r["grade"]:
        conflicts.add(k)
    if k not in pairs or ROUND_ORDER[r["round"]] > ROUND_ORDER[pairs[k]["round"]]:
        pairs[k] = r
for k in conflicts:
    pairs.pop(k, None)
print(f"pairs: {len(pairs)} | grade conflicts dropped: {len(conflicts)}")
known_grades = {k: v["grade"] for k, v in pairs.items()}
train_rows = [r for r in pairs.values() if r["grade"] != 1]
print(f"training rows (grade != 1): {len(train_rows)} "
      f"(zeros {sum(1 for r in train_rows if r['grade'] == 0)})")
by_hunt = defaultdict(list)
for r in train_rows:
    by_hunt[r["hunt"]].append(r)

snap_by_hunt = defaultdict(list)
for r in d["snapshot"]:
    snap_by_hunt[r["hunt"]].append(r)  # pools-full order = control order


def ndcg_at_10(rows, scores):
    order = np.argsort(-np.array(scores), kind="stable")
    gains = np.array([rows[i]["grade"] for i in order])[:10]
    ideal = np.array(sorted((r["grade"] for r in rows), reverse=True))[:10]
    dcg = sum(g / math.log2(i + 2) for i, g in enumerate(gains))
    idcg = sum(g / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg > 0 else 1.0


def fit(kind, rows):
    X = np.array([r["f"] for r in rows], dtype=float)
    y = np.array([r["grade"] for r in rows], dtype=float)
    if kind == "gbdt":
        m = GradientBoostingRegressor(
            max_depth=3, n_estimators=200, learning_rate=0.06,
            subsample=0.9, random_state=0)
    else:
        m = Ridge(alpha=1.0)
    m.fit(X, y)
    return m


rankings = {}
model_choices = {}
for h in range(1, 25):
    train_hunts = [x for x in range(1, 25) if x != h]
    inner_val = sorted(train_hunts)[-4:]
    inner_train = [x for x in train_hunts if x not in inner_val]
    rows_in = [r for x in inner_train for r in by_hunt[x]]
    rows_val = [r for x in inner_val for r in by_hunt[x]]
    scores = {}
    for kind in ("gbdt", "ridge"):
        m = fit(kind, rows_in)
        per_hunt = []
        for x in inner_val:
            rr = by_hunt[x]
            if rr:
                per_hunt.append(ndcg_at_10(rr, m.predict(
                    np.array([r["f"] for r in rr], dtype=float))))
        scores[kind] = float(np.mean(per_hunt)) if per_hunt else 0.0
    winner = "gbdt" if scores["gbdt"] >= scores["ridge"] else "ridge"
    model_choices[h] = {**scores, "winner": winner}
    full = fit(winner, [r for x in train_hunts for r in by_hunt[x]])
    snap = snap_by_hunt[h]
    pred = full.predict(np.array([r["f"] for r in snap], dtype=float))
    ltr_order = [snap[i]["adId"] for i in np.argsort(-pred, kind="stable")]
    control_order = [r["adId"] for r in snap]
    jr = sorted(snap, key=lambda r: 1 if r["f"][9] > 0.5 else 0)
    rankings[h] = {
        "control": control_order[:10],
        "ltr": ltr_order[:10],
        "judge": [r["adId"] for r in jr][:10],
    }

pool = {}
need = 0
for h in range(1, 25):
    union = []
    seen = set()
    for arm in ("control", "ltr", "judge"):
        for ad in rankings[h][arm]:
            if ad not in seen:
                seen.add(ad)
                union.append(ad)
    meta = {a["sourceAdId"]: a for a in pools[str(h)]}
    items = []
    for ad in union:
        if (h, ad) in known_grades:
            continue
        a = meta[ad]
        items.append({"adId": ad, "title": a["title"],
                      "desc": a.get("descSnippet", ""),
                      "price": a.get("price"), "city": a.get("city", ""),
                      "poolSide": a.get("poolSide", "S")})
    random.Random(1000 + h).shuffle(items)
    pool[h] = items
    need += len(items)

json.dump({"rankings": rankings, "modelChoices": model_choices},
          open(OUT_RANK, "w"), ensure_ascii=False)
json.dump(pool, open(OUT_POOL, "w"), ensure_ascii=False)
print(f"model choices: gbdt wins {sum(1 for v in model_choices.values() if v['winner']=='gbdt')}/24 folds")
print(f"blind grading pool: {need} NEW pairs to grade "
      f"(union top-10s across arms, historical grades reused)")
for h in range(1, 25):
    print(f"  H{h}: {len(pool[h])} new")
