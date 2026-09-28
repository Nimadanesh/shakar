// Persian text normalization for keyword matching.
//
// Pure function (no I/O): the single choke point every include/exclude
// keyword filter must pass input through before comparing. Keeps matching
// consistent regardless of which Arabic/Persian keyboard typed the text.
//
// Deliberate MVP decisions (revisit only with real-data evidence):
// - ZWNJ (half-space, U+200C) is preserved, not collapsed. "می‌شود" and
//   "می شود" therefore do NOT match each other; filters should encourage
//   the half-spaced form in helper copy.
// - Persian digits (۰-۹) are preserved; Arabic-Indic digits (٠-٩) map to
//   Persian digits so mixed-script years like "٢٠٢٠" match "۲۰۲۰".
// - Teh Marbuta (ة) maps to Heh (ه): "مدرسة" matches "مدرسه".

export function normalizePersian(input: string): string {
  return (
    input
      // Arabic diacritics (tashkeel U+064B–U+0652 only; the range deliberately
      // stops before Arabic-Indic digits U+0660+): "مَدرسه" -> "مدرسه"
      .replace(/[ً-ْ]/g, "")
      // Tatweel/kashida (U+0640): "کتــاب" -> "کتاب"
      .replace(/ـ/g, "")
      // Arabic Yeh (U+064A) -> Persian Yeh (U+06CC)
      .replace(/ي/g, "ی")
      // Arabic Kaf (U+0643) -> Persian Kaf (U+06A9)
      .replace(/ك/g, "ک")
      // Teh Marbuta (U+0629) -> Heh (U+0647)
      .replace(/ة/g, "ه")
      // Arabic-Indic digits (U+0660–U+0669) -> Persian digits (U+06F0–U+06F9)
      // so "٢٠٢٠" matches "۲۰۲۰"
      .replace(/[٠-٩]/g, (d) =>
        String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x06f0),
      )
      // Latin case folding; Persian script is unaffected
      .toLowerCase()
      // Collapse whitespace runs (spaces, tabs, newlines) to one space
      .replace(/\s+/g, " ")
      .trim()
  );
}
