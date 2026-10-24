# Issue 16 — Fresh Cross-Cell Review (Internal Key)

**Do not show this file before owner grades are committed.** It maps the blind IDs to source IDs and diagnostic engine outputs. It is not a human-grade file.

| Blind ID | Capture source ID | Query | Engine kind | Engine score | Eligible | Capture |
|---|---|---|---|---:|---|---|
| F16-01 | `gacXDBWE` | `حواله خودرو` | exact | 3.5 | true | Follow-up 03 #40063359140 |
| F16-02 | `gacbznRe` | `معاوضه خودرو` | near | 1.5 | true | Follow-up 03 #40063359140 |
| F16-03 | `wZ-6rn1v` | `یخچال` | exact | 3.5 | true | Follow-up 03 #40063359140 |
| F16-04 | `gacTj43d` | `فروشنده یخچال` (cross-category capture query was `فروشنده یخچال`) | exact | 3.5 | true | Cross-Category #40063359355 and Follow-up 03 #40063359140 |

## Integrity and limits

- The blind packet was committed before this key.
- All four source IDs are unique within this packet and absent from the prior human-grade packets' recorded source-ID overlap list.
- F16-04 appears in both latest capture artifacts but is included only once.
- This is bounded live capture (E3); it becomes E4 only after the owner grades the blind packet. It is not an old/new fixed-candidate comparison (E5).
- No source, role, kind-gate, or ranking change is authorized by these observations alone.
