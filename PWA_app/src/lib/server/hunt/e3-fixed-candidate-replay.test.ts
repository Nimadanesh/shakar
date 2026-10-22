import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { floorMatFlatbedConflict } from "./semantics";

const cases = [
  { alias: "P01", sourceAdId: "gaiCb1F-", query: "پیانو اکوستیک", title: "تولید انحصاری پیانو طرح آکوستیک ست کامل 160 میلیون", description: "شبیه به آکوستیک زده شده", humanGrade: 0 },
  { alias: "P02", sourceAdId: "gaZze3Z1", query: "پیانو اکوستیک", title: "پیانو اکوستیک m2 یاماها", description: "پیانو مکانیکی یاماها مدل m2", humanGrade: 3 },
  { alias: "P03", sourceAdId: "gaZzOCha", query: "پیانو اکوستیک", title: "فروش پیانو آکوستیک و دیجیتال", description: "فروش انواع پیانو آکوستیک و دیجیتال", humanGrade: 3 },
  { alias: "P04", sourceAdId: "gaZb-8lt", query: "پیانو اکوستیک", title: "پیانو یاماها SLP-48 طرح آکوستیک", description: "SLP-48 طرح آکوستیک یاماها", humanGrade: 0 },
  { alias: "P05", sourceAdId: "gaZnujck", query: "پیانو اکوستیک", title: "پیانو اکوستیک ژاپنی یاماها مدل u10", description: "پیانو مکانیکی یاماها مدل u10", humanGrade: 3 },
  { alias: "P06", sourceAdId: "Qa0_1GLb", query: "پیانو اکوستیک", title: "وارد کننده مستقیم پیانو آکوستیک و دیجیتال یاماها", description: "پیانو آکوستیک دیواری یاماها U YU YUS", humanGrade: 3 },
  { alias: "K01", sourceAdId: "gaZvu9P8", query: "کفی ماشین", title: "ست کف پایی و کفی صندوق ماشین تارا،بسیار تمیز ونو", description: "ست کف پایی تارا و کفی صندوق عقب", humanGrade: 3 },
  { alias: "E17", sourceAdId: "gaYjJe4y", query: "کفی ماشین", title: "لاستیک و کف پوش ماشین", description: "کف پوش سه بعدی جنس عالی قیمت توافقی", humanGrade: 3 },
  { alias: "E19", sourceAdId: "gaXjCsU5", query: "کفی ماشین", title: "کفی سه بعدی نمدی فابریکی اطلس", description: "کفی سه بعدی نمدی فابریک اطلس نو استفاده نشده", humanGrade: 3 },
  { alias: "N01", sourceAdId: "gaA3NPYd", query: "کفی ماشین", title: "آریسان ۲ با کفی و باربند", description: "دوگانه سوز ۴۰۳ با کفی و باربند روکش صندلی", humanGrade: 0 },
  { alias: "N02", sourceAdId: "gaYDXysD", query: "کفی ماشین", title: "کفی تریلر", description: "سلام تریلی چرخ 24", humanGrade: 0 },
  { alias: "U01", sourceAdId: "gaYrmNKn", query: "کفی ماشین", title: "کفی تریلی ۲محور رول کش بالونی ۱۲/۶۰", description: "تیغه مبارکه سالم بدون شکستگی", humanGrade: null },
  { alias: "U02", sourceAdId: "gaY3kLJH", query: "کفی ماشین", title: "کفی ایران کاوه", description: "کفی ایران کاوه مدل 71 سری اول شرکت ایران کاوه", humanGrade: null },
  { alias: "U03", sourceAdId: "gaWrknHH", query: "کفی ماشین", title: "کفی تریلی خوزستان شوش", description: "کفی تریلی", humanGrade: null },
  { alias: "U04", sourceAdId: "gaUv8moP", query: "کفی ماشین", title: "کفی دو مهور", description: "کفی دو محور", humanGrade: null },
  { alias: "U05", sourceAdId: "gaUrqiuA", query: "کفی ماشین", title: "کفی مارال ۱۳/۷۰", description: "کفی مارال لاستیک ۶۰درصد آماده کار", humanGrade: null },
  { alias: "AMB01", sourceAdId: "gaYfZnPP", query: "کفی ماشین", title: "کفی مبلی نیسانی", description: "کفی مبلی مخصوص نیسان دوگانه دستی", humanGrade: "insufficient" },
] as const;

it("replays the same fixed E3 candidate records through the floor-mat guard", async () => {
  const replay = cases.map((item) => ({
    ...item,
    guardConflict: floorMatFlatbedConflict(item.query, item.title, item.description),
  }));

  const ambiguous = replay.find((item) => item.alias === "AMB01");
  expect(ambiguous).toBeDefined();

  if (process.env.E3_REPLAY_MODE === "baseline") {
    expect(ambiguous?.guardConflict).toContain("wrong-kind:floor-mat-vs-flatbed");
  } else {
    expect(process.env.E3_REPLAY_MODE).toBe("current");
    expect(ambiguous?.guardConflict).toBeNull();
  }

  for (const item of replay.filter((entry) => entry.alias.startsWith("P"))) {
    expect(item.guardConflict, item.alias).toBeNull();
  }
  for (const alias of ["K01", "E17", "E19"]) {
    expect(replay.find((item) => item.alias === alias)?.guardConflict, alias).toBeNull();
  }
  for (const alias of ["N01", "N02", "U01", "U02", "U03", "U04", "U05"]) {
    expect(replay.find((item) => item.alias === alias)?.guardConflict, alias).not.toBeNull();
  }

  const outputPath = process.env.E3_REPLAY_OUTPUT;
  if (outputPath) await writeFile(outputPath, JSON.stringify({
    kind: "e3-fixed-candidate-guard-replay",
    mode: process.env.E3_REPLAY_MODE,
    sourceCommit: process.env.GITHUB_SHA ?? "local",
    candidates: replay,
    scopeWarning: "This replays the floor-mat conflict guard only; it does not rerun retrieval, full pipeline scoring, or ranking.",
  }, null, 2), "utf8");
  console.log("E3_FIXED_CANDIDATE_GUARD_REPLAY=" + JSON.stringify(replay.map((item) => ({
    alias: item.alias, sourceAdId: item.sourceAdId, humanGrade: item.humanGrade,
    guardConflict: item.guardConflict,
  }))));
});
