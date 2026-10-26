import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeForMatch, textMatches } from "@/lib/persianNormalize";
import { floorMatFlatbedConflict } from "./semantics";

interface FrozenRecord {
  sourceAdId: string;
  title: string;
  descriptionExcerpt: string;
}

function loadFrozenRecords(): FrozenRecord[] {
  const encoded = readFileSync(
    new URL("../../../../docs/engine-v3/evaluations/fixtures/kafi-machine-artifact-records.json.gz.base64", import.meta.url),
    "utf8"
  );
  return JSON.parse(
    gunzipSync(Buffer.from(encoded, "base64")).toString("utf8")
  ) as FrozenRecord[];
}

describe("archived کفی ماشین excerpt replay (characterization only)", () => {
  it("runs the real guard over every frozen excerpt without blessing unreviewed outcomes", () => {
    const records = loadFrozenRecords();
    expect(records).toHaveLength(59);

    const outcomes = records.map((record) => ({
      sourceAdId: record.sourceAdId,
      title: record.title,
      reason: floorMatFlatbedConflict(
        "کفی ماشین",
        record.title,
        record.descriptionExcerpt
      ),
    }));

    // Only the already-grounded controls below are correctness assertions.
    // Other outcomes are emitted for inspection, not promoted to expected behavior.
    const byId = new Map(outcomes.map((outcome) => [outcome.sourceAdId, outcome]));
    expect(byId.get("gaYDXysD")?.reason).toBe(
      "wrong-kind:floor-mat-vs-flatbed:تریلی"
    );
    expect(byId.get("gaYf5rLj")?.reason).toBe(
      "wrong-kind:floor-mat-vs-flatbed:جرثقیل"
    );
    for (const id of ["gaI0HKIy", "ga4uraIe", "gaYfZnPP", "gagsCTyG", "gaXjCsU5"]) {
      expect(byId.get(id)?.reason, id).toBeNull();
    }

    const firstCueCounts = outcomes.reduce<Record<string, number>>((counts, outcome) => {
      const cue = outcome.reason?.split(":").slice(2).join(":");
      if (cue) counts[cue] = (counts[cue] ?? 0) + 1;
      return counts;
    }, {});
    console.info(
      "FLOORMAT_ARCHIVED_REPLAY=" +
        JSON.stringify({
          records: outcomes.length,
          matchedKafiCount: records.filter((record) =>
            textMatches(
              normalizeForMatch(`${record.title} ${record.descriptionExcerpt}`),
              "کفی"
            )
          ).length,
          returnedCueCount: outcomes.filter((outcome) => outcome.reason !== null).length,
          firstCueCounts,
          outcomes,
        })
    );
  });
});
