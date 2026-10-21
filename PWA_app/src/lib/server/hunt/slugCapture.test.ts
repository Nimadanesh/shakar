import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { flushSlugCaptures } from "./slugCapture";
import type { SupabaseServer } from "@/lib/supabase-server";

const pairs = new Map<string, string>([
  ["ad-1", "vehicle/car/pride"],
  ["ad-2", "vehicle/car/samand"],
]);

function fakeSb(impl: () => Promise<unknown>): SupabaseServer {
  return {
    url: "http://example.test",
    rest: vi.fn(async () => impl()) as SupabaseServer["rest"],
  };
}

const dirs: string[] = [];
function tempBuffer(): string {
  const dir = mkdtempSync(join(tmpdir(), "slugcap-"));
  dirs.push(dir);
  return join(dir, "buffer.jsonl");
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("flushSlugCaptures (Step 0.5)", () => {
  it("empty map is a no-op", async () => {
    const sb = fakeSb(async () => []);
    const s = await flushSlugCaptures(new Map(), { sb });
    expect(s).toEqual({ attempted: 0, written: 0, failed: 0, buffered: 0 });
    expect(sb.rest).not.toHaveBeenCalled();
  });

  it("writes rows with the dedup prefer header when a client exists", async () => {
    const sb = fakeSb(async () => []);
    const s = await flushSlugCaptures(pairs, {
      sb,
      now: new Date("2026-10-21T12:00:00Z"),
    });
    expect(s).toEqual({ attempted: 2, written: 2, failed: 0, buffered: 0 });
    const call = (sb.rest as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("POST");
    expect(call[1]).toBe("ad_slug_captures");
    expect(call[2]).toEqual([
      { ad_id: "ad-1", category_slug: "vehicle/car/pride", capture_date: "2026-10-21" },
      { ad_id: "ad-2", category_slug: "vehicle/car/samand", capture_date: "2026-10-21" },
    ]);
    expect(call[3]).toContain("resolution=ignore-duplicates");
  });

  it("fails open when the insert errors — counted, never thrown", async () => {
    const sb = fakeSb(async () => {
      throw new Error("db down");
    });
    const s = await flushSlugCaptures(pairs, { sb });
    expect(s).toEqual({ attempted: 2, written: 0, failed: 2, buffered: 0 });
  });

  it("fails open when the insert exceeds the bounded wait", async () => {
    const sb = fakeSb(() => new Promise(() => {})); // never resolves
    const s = await flushSlugCaptures(pairs, { sb, timeoutMs: 20 });
    expect(s.failed).toBe(2);
    expect(s.written).toBe(0);
  });

  it("buffers to the local JSONL file when no client is configured", async () => {
    const path = tempBuffer();
    const s = await flushSlugCaptures(pairs, {
      sb: null,
      bufferPath: path,
      now: new Date("2026-10-21T12:00:00Z"),
    });
    expect(s).toEqual({ attempted: 2, written: 0, failed: 0, buffered: 2 });
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]) as Record<string, string>;
    expect(first.ad_id).toBe("ad-1");
    expect(first.category_slug).toBe("vehicle/car/pride");
    expect(first.capture_date).toBe("2026-10-21");
  });

  it("counts failed when even the buffer write fails", async () => {
    const s = await flushSlugCaptures(pairs, {
      sb: null,
      bufferPath: "/nonexistent-dir-xyz/buffer.jsonl",
    });
    expect(s).toEqual({ attempted: 2, written: 0, failed: 2, buffered: 0 });
  });
});
