# Exchange-side attribute polarity — follow-up from Run 102

Date: 2026-10-23
Branch: `engine_v3`
Status: design/test gate only; no ranking integration.

## Locked human evidence

- Run 102 grades: `V01=0, V02=2`, recorded in `BRH-2026-10-23-RUN102-VEHICLE-EXCHANGE-HUMAN-GRADES.md`.
- V01 explicitly contradicts the requested attribute: `پژو ۲۰۶ ... کلا یه کف دست گلگیر عقب سمت راننده رنگ داره`. Unrelated phrases such as `بدون خرج`, `بدون پوسیدگی`, and `بدون خط خش` do not support `بدون رنگ`.
- V02 has the requested Peugeot on the correct side but no paint-condition evidence for that Peugeot. `رنگ ناردو` describes the offered Yamaha, so the attribute is unknown.
- Run 102 contains no grade-3 positive example. The pair establishes a 0-versus-2 distinction only.

## Capability gap exposed

`assessExchangeTargetEvidence` currently returns only `supported | unknown`. It can require exact item and attribute phrases on the same segmented side, but cannot represent explicit contradiction as a distinct evidence state. Do not turn absence of a positive phrase into contradiction.

A future diagnostic extension should consider a three-state result for the target item on the correct side:

1. `supported`: direct positive attribute evidence belongs to the target item and its exchange side.
2. `contradicted`: direct, scoped counter-evidence negates the requested attribute for that same item.
3. `unknown`: attribute is absent, belongs to the opposite-side item, or cannot be safely scoped.

## Required regression cases before integration

- Vehicle contradiction: target Peugeot side explicitly says one fender has paint -> contradicted, not supported.
- Vehicle unknown: Yamaha side says `رنگ ناردو`, requested Peugeot has no paint evidence -> unknown.
- Positive control: target Peugeot's own side explicitly says `بدون رنگ` / `تمام فابریک بدون رنگ` -> supported.
- Negation locality: `بدون خرج`, `بدون پوسیدگی`, `بدون خط خش` must not satisfy or contradict `بدون رنگ`.
- Opposite-side isolation: a positive or negative paint phrase about the Yamaha must not transfer to the Peugeot.
- Negation scope: phrases like `رنگ دارد`, `یک گلگیر رنگ`, and `بدون رنگ` must be distinguished without treating a generic word `رنگ` as sufficient.
- Ambiguity and malformed/missing exchange boundaries remain unknown.
- Keep exact token boundaries and do not introduce global synonyms or broad `بدون` matching.

## Decision gate

Collect additional unique blind-graded examples, especially at least one clear grade-3 positive and more explicit contradiction/unknown counterexamples. Then implement and test the richer diagnostic state in isolation. Only after human-reviewed tests cover both offered/requested target sides and negation scope should a separate integration proposal be considered.

No production ranking change, main merge, or deployment is authorized by this note.
