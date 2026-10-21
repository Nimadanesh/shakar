#!/usr/bin/env python3
"""
Golden benchmark v2 — Decision v2 harness gate (2026-10-20).

Changes from v1 (which failed the Decision v2 sec.8.2 gate):
  - Grades are keyed by ad ID (sourceAdId), NEVER positional. Legacy
    positional grade files are refused loudly (convert first with
    grades-to-idkeyed.py).
  - Emits the Decision v2 metrics: per-hunt and corpus counts of
    grade 0 / 3 / 2 inside the top-10 (Z, G3, G2), alongside nDCG@10,
    P@5 and the grade total.
  - Every inconsistency is a HARD FAILURE (exit 2, no metrics printed):
    missing done file, missing grade for a top-10 ad, grade for an ad
    not in the top-10, duplicate ad IDs, ungraded done files, corrupt
    JSON. A partial or mismatched input must never yield a number.

Usage:
  python3 scripts/golden-benchmark.py <done-dir> <grades-idkeyed.json>

  done-dir: done-N.json files, plain JSON or SSE ("data: {...done...}")
  grades:   {hunts: [{n, query, gradesByAdId: {sourceAdId: 0..3}}]}
"""
import json
import glob
import math
import os
import sys


def fail(msg):
    print(f"HARNESS ERROR: {msg}", file=sys.stderr)
    sys.exit(2)


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
        fail(f"{path}: SSE stream without a parseable done event")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        fail(f"{path}: corrupt JSON ({e})")


def ndcg(ranked_grades, k=10):
    top = ranked_grades[:k]
    dcg = sum((2**g - 1) / math.log2(i + 2) for i, g in enumerate(top))
    ideal = sorted(ranked_grades, reverse=True)[:k]
    idcg = sum((2**g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg > 0 else 0.0


def p_at_k(ranked_grades, k=5, rel=2):
    top = ranked_grades[:k]
    return sum(1 for g in top if g >= rel) / k if top else 0.0


def main():
    if len(sys.argv) != 3:
        fail("usage: golden-benchmark.py <done-dir> <grades-idkeyed.json>")
    done_dir, grades_path = sys.argv[1], sys.argv[2]
    try:
        grades_doc = json.load(open(grades_path, encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read grades file: {e}")
    hunts = grades_doc.get("hunts")
    if not isinstance(hunts, list):
        fail("grades file has no 'hunts' list")
    gmap = {}
    for h in hunts:
        if "grades" in h and "gradesByAdId" not in h:
            fail(
                f"hunt {h.get('n')}: legacy POSITIONAL grades refused — "
                "run grades-to-idkeyed.py first (Decision v2: grade by ad ID, never positionally)"
            )
        if "gradesByAdId" not in h:
            fail(f"hunt {h.get('n')}: no gradesByAdId")
        gmap[h["n"]] = h

    done_files = {}
    for f in sorted(glob.glob(os.path.join(done_dir, "done-*.json"))):
        n = int(os.path.basename(f).split("-")[1].split(".")[0])
        done_files[n] = f
    for n in gmap:
        if n not in done_files:
            fail(f"hunt {n}: graded but no done file in {done_dir}")
    for n in done_files:
        if n not in gmap:
            fail(f"hunt {n}: done file present but no grades — refusing partial metrics")

    rows = []
    for n in sorted(gmap):
        d = load_done(done_files[n])
        results = d.get("results")
        if not isinstance(results, list) or not results:
            fail(f"hunt {n}: done file has no results")
        ids = [r.get("sourceAdId") for r in results]
        if any(i is None for i in ids):
            fail(f"hunt {n}: a result lacks sourceAdId")
        if len(set(ids)) != len(ids):
            fail(f"hunt {n}: duplicate sourceAdId in results")
        by_id = gmap[n]["gradesByAdId"]
        top_ids = ids[:10]
        for ad_id in by_id:
            if ad_id not in top_ids:
                fail(f"hunt {n}: grade recorded for ad {ad_id} which is not in the top-10 — done file does not match the graded run")
        ranked = []
        for ad_id in top_ids:
            if ad_id not in by_id:
                fail(f"hunt {n}: top-10 ad {ad_id} has no grade — refusing to fabricate one")
            g = by_id[ad_id]
            if g not in (0, 1, 2, 3):
                fail(f"hunt {n}: grade {g} for ad {ad_id} is not 0..3")
            ranked.append(g)
        rows.append(
            {
                "n": n,
                "query": (gmap[n].get("query") or "")[:28],
                "z": ranked.count(0),
                "g3": ranked.count(3),
                "g2": ranked.count(2),
                "ndcg10": ndcg(ranked, 10),
                "p5": p_at_k(ranked, 5),
                "r1zero": 1 if ranked and ranked[0] == 0 else 0,
                "total": sum(ranked),
            }
        )

    print(f"{'n':>3}  {'query':<30} {'Z':>3} {'G3':>3} {'G2':>3} {'nDCG@10':>8} {'P@5':>6} {'r1z':>4} {'total':>6}")
    for r in rows:
        print(
            f"{r['n']:>3}  {r['query']:<30} {r['z']:>3} {r['g3']:>3} {r['g2']:>3} "
            f"{r['ndcg10']:>8.3f} {r['p5']:>6.3f} {r['r1zero']:>4d} {r['total']:>6d}"
        )
    z = sum(r["z"] for r in rows)
    g3 = sum(r["g3"] for r in rows)
    g2 = sum(r["g2"] for r in rows)
    tot = sum(r["total"] for r in rows)
    avg_ndcg = sum(r["ndcg10"] for r in rows) / len(rows)
    avg_p5 = sum(r["p5"] for r in rows) / len(rows)
    r1z = sum(r["r1zero"] for r in rows)
    print(
        f"\nCORPUS  Z={z}  G3={g3}  G2={g2}  total={tot}/{len(rows)*30}  "
        f"nDCG@10={avg_ndcg:.3f}  P@5={avg_p5:.3f}  rank-1-zeros={r1z}/{len(rows)}"
    )


if __name__ == "__main__":
    main()
