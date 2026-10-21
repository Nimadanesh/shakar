#!/usr/bin/env python3
"""
Convert legacy positional grades to ad-ID-keyed grades (Decision v2).

Legacy grade files store grades as [0..3 x10] "in rank order" — valid
ONLY because the grading packet rendered the done file's results[:10]
in order. This converter performs that join ONCE, explicitly:
grades[i] -> results[i].sourceAdId, with validation (enough results,
unique IDs). The output is what golden-benchmark.py v2 accepts.

Rejected-sample grades (rejectedGrades, by rank) are converted to
rejectedByRank with the rejected ad's title recorded for audit —
rejectedSample entries carry no sourceAdId in the engine's stats.

Usage:
  python3 scripts/grades-to-idkeyed.py <done-dir> <legacy-grades.json> <out.json>
"""
import json
import glob
import os
import sys


def fail(msg):
    print(f"CONVERT ERROR: {msg}", file=sys.stderr)
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


def main():
    if len(sys.argv) != 4:
        fail("usage: grades-to-idkeyed.py <done-dir> <legacy-grades.json> <out.json>")
    done_dir, legacy_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    legacy = json.load(open(legacy_path, encoding="utf-8-sig"))
    done_files = {}
    for f in glob.glob(os.path.join(done_dir, "done-*.json")):
        n = int(os.path.basename(f).split("-")[1].split(".")[0])
        done_files[n] = f

    out_hunts = []
    for h in legacy["hunts"]:
        n = h["n"]
        if n not in done_files:
            fail(f"hunt {n}: no done file — cannot key grades by ad ID")
        d = load_done(done_files[n])
        results = d.get("results") or []
        grades = h["grades"]
        if len(results) < len(grades):
            fail(f"hunt {n}: {len(grades)} grades but only {len(results)} results")
        by_id = {}
        for i, g in enumerate(grades):
            ad_id = results[i].get("sourceAdId")
            if not ad_id:
                fail(f"hunt {n}: result #{i + 1} lacks sourceAdId")
            if ad_id in by_id:
                fail(f"hunt {n}: duplicate sourceAdId {ad_id} in top results")
            by_id[ad_id] = g
        entry = {"n": n, "query": h.get("query", ""), "gradesByAdId": by_id}
        rej = h.get("rejectedGrades") or []
        if rej:
            sample = (d.get("stats") or {}).get("rejectedSample") or []
            by_rank = []
            for r in rej:
                rank = r["rank"]
                title = sample[rank - 1].get("title") if 1 <= rank <= len(sample) else None
                by_rank.append({"rank": rank, "grade": r["grade"], "title": title})
            entry["rejectedByRank"] = by_rank
        out_hunts.append(entry)

    out = {
        "engine": legacy.get("engine"),
        "gradedBy": legacy.get("gradedBy"),
        "date": legacy.get("date"),
        "keyedBy": "sourceAdId via grades-to-idkeyed.py (join: packet rendered results[:10] in order)",
        "hunts": out_hunts,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"wrote {out_path}: {len(out_hunts)} hunts keyed by ad ID")


if __name__ == "__main__":
    main()
