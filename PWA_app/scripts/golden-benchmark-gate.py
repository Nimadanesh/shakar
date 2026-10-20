#!/usr/bin/env python3
"""
Harness health gate — Decision v2 sec.8.2 (2026-10-20).

Before ANY score from golden-benchmark.py is trusted, this gate must
pass. Checks (synthetic fixtures, plus an optional real-data
reproduction):

  1. Base fixture produces the exact expected Z/G3/G2/total.
  2. Shuffling the result order (grades stay with their ad IDs) leaves
     Z/G3/G2/total unchanged and MUST change nDCG@10 — proves the join
     is by ad ID and the ranking metric is order-sensitive.
  3. Swapping one top-10 ad for a known grade-0 ad raises Z by
     exactly 1.
  4. Corrupt inputs fail loudly (non-zero exit, no CORPUS line):
     truncated done file, grade for an unknown ad, missing grade for
     a top-10 ad, legacy positional grades, ungraded done file.
  5. Real-data reproduction (when paths are given): R11's known human
     verdict — total=655, Z=20, H7 Z=5, H8 Z=5, H12 Z=4 — must be
     reproduced exactly from ID-keyed grades.

Usage:
  python3 scripts/golden-benchmark-gate.py [--real-done-dir DIR --real-legacy-grades FILE]
Exit 0 only if every check passes.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
BENCH = os.path.join(HERE, "golden-benchmark.py")
CONVERT = os.path.join(HERE, "grades-to-idkeyed.py")

FAILURES = []


def check(name, cond, detail=""):
    print(f"{'PASS' if cond else 'FAIL'}  {name}{' — ' + detail if detail and not cond else ''}")
    if not cond:
        FAILURES.append(name)


def run_bench(done_dir, grades_path):
    p = subprocess.run(
        [sys.executable, BENCH, done_dir, grades_path],
        capture_output=True, text=True,
    )
    corpus = {}
    for line in p.stdout.splitlines():
        if line.startswith("CORPUS"):
            for tok in line.replace("CORPUS", "").split():
                if "=" in tok:
                    k, v = tok.split("=", 1)
                    corpus[k] = v
    return p, corpus


def write_fixture(root, results, grades_by_id, sse=False, extra_done=None):
    done_dir = os.path.join(root, "dones")
    os.makedirs(done_dir, exist_ok=True)
    payload = {"type": "done", "results": results, "stats": {}}
    text = json.dumps(payload, ensure_ascii=False)
    if sse:
        text = f"data: {text}\n"
    with open(os.path.join(done_dir, "done-1.json"), "w", encoding="utf-8") as f:
        f.write(text)
    if extra_done:
        with open(os.path.join(done_dir, "done-2.json"), "w", encoding="utf-8") as f:
            f.write(extra_done)
    grades = {"hunts": [{"n": 1, "query": "fixture", "gradesByAdId": grades_by_id}]}
    gp = os.path.join(root, "grades.json")
    with open(gp, "w", encoding="utf-8") as f:
        json.dump(grades, f, ensure_ascii=False)
    return done_dir, gp


def ads(ids):
    return [{"sourceAdId": i, "title": f"ad {i}"} for i in ids]


def main():
    ids = [f"A{i}" for i in range(1, 11)]
    grades = {"A1": 3, "A2": 3, "A3": 2, "A4": 0, "A5": 3,
              "A6": 2, "A7": 3, "A8": 1, "A9": 2, "A10": 3}

    with tempfile.TemporaryDirectory() as td:
        # 1. base (SSE-wrapped fixture: also proves the SSE parse path)
        dd, gp = write_fixture(os.path.join(td, "base"), ads(ids), grades, sse=True)
        p, c = run_bench(dd, gp)
        check("base fixture exact", p.returncode == 0 and c.get("Z") == "1" and c.get("G3") == "5"
              and c.get("G2") == "3" and c.get("total") == "22/30", f"rc={p.returncode} corpus={c}")
        base_ndcg = c.get("nDCG@10")

        # 2. shuffled order, same ID-keyed grades
        dd, gp = write_fixture(os.path.join(td, "shuf"), ads(list(reversed(ids))), grades)
        p, c = run_bench(dd, gp)
        check("shuffle: counts follow ad IDs", p.returncode == 0 and c.get("Z") == "1"
              and c.get("G3") == "5" and c.get("G2") == "3" and c.get("total") == "22/30",
              f"rc={p.returncode} corpus={c}")
        check("shuffle: nDCG is order-sensitive", c.get("nDCG@10") != base_ndcg,
              f"base={base_ndcg} shuffled={c.get('nDCG@10')}")

        # 3. swap A2 (grade 3) for A11 (grade 0)
        ids2 = ["A1", "A11"] + ids[2:]
        g2 = dict(grades); g2["A11"] = 0; del g2["A2"]
        dd, gp = write_fixture(os.path.join(td, "swap"), ads(ids2), g2)
        p, c = run_bench(dd, gp)
        check("swap one grade-0 in: Z +1 exactly", p.returncode == 0 and c.get("Z") == "2"
              and c.get("total") == "19/30", f"rc={p.returncode} corpus={c}")

        # 4a. truncated done file
        dd, gp = write_fixture(os.path.join(td, "trunc"), ads(ids), grades)
        with open(os.path.join(dd, "done-1.json"), "w", encoding="utf-8") as f:
            f.write('{"results": [{"sourceAdId": "A1"')
        p, c = run_bench(dd, gp)
        check("corrupt: truncated done fails loudly", p.returncode != 0 and not c,
              f"rc={p.returncode} corpus={c}")

        # 4b. grade for an unknown ad
        g3 = dict(grades); g3["ZZZ"] = 3
        dd, gp = write_fixture(os.path.join(td, "unk"), ads(ids), g3)
        p, c = run_bench(dd, gp)
        check("corrupt: unknown-ad grade fails loudly", p.returncode != 0 and not c,
              f"rc={p.returncode} corpus={c}")

        # 4c. missing grade for a top-10 ad
        g4 = dict(grades); del g4["A5"]
        dd, gp = write_fixture(os.path.join(td, "miss"), ads(ids), g4)
        p, c = run_bench(dd, gp)
        check("corrupt: missing top-10 grade fails loudly", p.returncode != 0 and not c,
              f"rc={p.returncode} corpus={c}")

        # 4d. legacy positional grades refused
        dd, gp = write_fixture(os.path.join(td, "leg"), ads(ids), grades)
        with open(gp, "w", encoding="utf-8") as f:
            json.dump({"hunts": [{"n": 1, "query": "fixture", "grades": [3] * 10}]}, f)
        p, c = run_bench(dd, gp)
        check("corrupt: legacy positional grades refused", p.returncode != 0 and not c,
              f"rc={p.returncode} corpus={c}")

        # 4e. ungraded done file present
        dd, gp = write_fixture(os.path.join(td, "ungr"), ads(ids), grades,
                               extra_done=json.dumps({"results": ads(ids)}))
        p, c = run_bench(dd, gp)
        check("corrupt: ungraded done file fails loudly", p.returncode != 0 and not c,
              f"rc={p.returncode} corpus={c}")

    # 5. real-data reproduction
    args = sys.argv[1:]
    if "--real-done-dir" in args and "--real-legacy-grades" in args:
        done_dir = args[args.index("--real-done-dir") + 1]
        legacy = args[args.index("--real-legacy-grades") + 1]
        with tempfile.TemporaryDirectory() as td:
            out = os.path.join(td, "idkeyed.json")
            p = subprocess.run([sys.executable, CONVERT, done_dir, legacy, out],
                               capture_output=True, text=True)
            check("real: conversion succeeds", p.returncode == 0, p.stderr.strip()[:200])
            if p.returncode == 0:
                p2, c = run_bench(done_dir, out)
                check("real: R11 total reproduced (655)", p2.returncode == 0 and c.get("total") == "655/720",
                      f"rc={p2.returncode} corpus={c}")
                check("real: R11 Z reproduced (20)", c.get("Z") == "20", f"Z={c.get('Z')}")
                per = {}
                for line in p2.stdout.splitlines():
                    parts = line.split()
                    if parts and parts[0].isdigit() and len(parts) >= 4:
                        per[int(parts[0])] = parts[-7]  # Z column position after query text varies; fallback below
                # robust per-hunt Z: recompute from the converted file directly
                doc = json.load(open(out, encoding="utf-8"))
                zper = {h["n"]: list(h["gradesByAdId"].values()).count(0) for h in doc["hunts"]}
                check("real: per-hunt zeros H7=5 H8=5 H12=4",
                      zper.get(7) == 5 and zper.get(8) == 5 and zper.get(12) == 4,
                      f"H7={zper.get(7)} H8={zper.get(8)} H12={zper.get(12)}")
    else:
        print("SKIP  real-data reproduction (pass --real-done-dir and --real-legacy-grades)")

    print(f"\n{'GATE: ALL PASS' if not FAILURES else 'GATE: FAILED — ' + ', '.join(FAILURES)}")
    sys.exit(0 if not FAILURES else 1)


if __name__ == "__main__":
    main()
