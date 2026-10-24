# Issue 16 — Capture 05D internal key (do not use before blind grades lock)

Date: 2026-10-24  
Source: [bounded live capture run 40080467492](https://github.com/Nimadanesh/shakar/actions/runs/40080467492), artifact `12554818835`. Target scored for every row: `خرید و فروش خودرو`. Raw diagnostics only; this key does not contain human grades.

| Blind label | Source ID | Retrieval query | Cell | Engine eligible | Engine matchKind | Engine score | Engine evidence / missing | Detail status |
|---|---|---|---|---:|---|---:|---|---|
| D01 | `gaI-h9VF` | `تعمیر کاتالیزور خودرو` | part-service-negative | yes | near | 2.8333 | خرید، فروش، خودرو / none | known |
| D02 | `ga0mOydc` | `فروش تویوتا` | whole-vehicle-positive | yes | near | 2.8333 | خرید، فروش، خودرو / none | known |
| D03 | `gaTPiMW9` | `فروش لوازم یدکی خودرو` | other-part-negative | yes | exact | 2.8333 | خرید، فروش، خودرو / none | known |
| D04 | `gaUTKxZ6` | `فروش کاتالیزور با ضمانت` | catalyst-only-negative | yes | near | -0.8333 | خرید، فروش / خودرو | known |
| D05 | `gacTnnuH` | `فروش دنا پلاس` | whole-vehicle-positive | yes | near | 0.8333 | فروش / خرید، خودرو | known |
| D06 | `gaI-nHG5` | `کاتالیزور خودرو` | catalyst-only-negative | yes | near | 0.8333 | خودرو / خرید، فروش | known |
| D07 | `gaYT6L-w` | `خرید و فروش خودرو کارکرده` | whole-vehicle-positive | yes | near | 2.1667 | فروش، خودرو / خرید | known |
| D08 | `gaO-ZfFH` | `خریدار کاتالیزور فرسوده` | catalyst-only-negative | no | rejected | — | — | known |

**Capture integrity:** 8/8 detail reads used; 8 unique IDs; 2 pages maximum per retrieval query; Mizan shadow disabled. The workflow's overlap list records previously inspected IDs that were excluded from this run; none of D01–D08 is one of those listed IDs. Do not treat this sample as random or as a paired quality comparison.

**Important:** Do not reveal this mapping until human scores for D01–D08 are locked. Keep source IDs and engine outputs out of the blind packet.
