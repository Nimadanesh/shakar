#!/usr/bin/env python3
"""
Golden benchmark — R7 (2026-10-18).

Computes ranking metrics (nDCG@10, P@5) for a laptop round's done files
against navid's human grades. This is the apples-to-apples round
comparison (DeepSeek blind spot: "grow the benchmark from the live
rounds instead of a detached 13-case seed").

Usage:
  python3 scripts/golden-benchmark.py <done-dir> <grades.json>

  done-dir:  directory with done-N.json (BOM-encoded, has .results in rank order)
  grades.json: {hunts: [{n, query, grades: [0-3 x10 in rank order]}]}

Output: per-hunt nDCG@10 / P@5 table + corpus summary.
"""
import json
import glob
import math
import os
import sys


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
    done_dir, grades_path = sys.argv[1], sys.argv[2]
    grades = json.load(open(grades_path, encoding="utf-8-sig"))["hunts"]
    gmap = {h["n"]: h for h in grades}

    rows = []
    for f in sorted(glob.glob(os.path.join(done_dir, "done-*.json"))):
        n = int(os.path.basename(f).split("-")[1].split(".")[0])
        d = json.load(open(f, encoding="utf-8-sig"))
        h = gmap.get(n)
        if not h:
            continue
        gr = h["grades"]
        nres = len(d.get("results", []))
        # grades align with rank order; pad/truncate to results length
        rg = (gr + [0] * nres)[:nres]
        rows.append(
            {
                "n": n,
                "query": h["query"][:28],
                "ndcg10": ndcg(rg, 10),
                "p5": p_at_k(rg, 5),
                "r1zero": 1 if rg and rg[0] == 0 else 0,
                "total": sum(gr),
            }
        )

    print(f"{'n':>3}  {'query':<30} {'nDCG@10':>8} {'P@5':>6} {'r1-zero':>8} {'total':>6}")
    for r in rows:
        print(
            f"{r['n']:>3}  {r['query']:<30} {r['ndcg10']:>8.3f} {r['p5']:>6.3f} "
            f"{r['r1zero']:>8d} {r['total']:>6d}"
        )
    if rows:
        avg_ndcg = sum(r["ndcg10"] for r in rows) / len(rows)
        avg_p5 = sum(r["p5"] for r in rows) / len(rows)
        tot = sum(r["total"] for r in rows)
        r1z = sum(r["r1zero"] for r in rows)
        print(f"\nCORPUS  nDCG@10={avg_ndcg:.3f}  P@5={avg_p5:.3f}  total={tot}/{len(rows)*30}  rank-1-zeros={r1z}/{len(rows)}")


if __name__ == "__main__":
    main()
