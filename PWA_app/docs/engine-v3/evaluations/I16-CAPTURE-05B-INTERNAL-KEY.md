# Issue 16 — Capture 05B Internal Key

Status: internal key; keep separate from the blind packet during grading.  
Capture run: https://github.com/Nimadanesh/shakar/actions/runs/40072417965  
Artifact ID: 12551573898  
Target: `خرید و فروش خودرو`, category `vehicles`.

| Blind ID | Source ad ID | Retrieval query | Engine result | Match kind | Score | Rejected kind |
|---|---|---|---|---|---:|---|
| H05B-01 | gacXlFBL | فروش پراید | eligible | near | 1.8333 | — |
| H05B-02 | gazms9IA | نمایشگاه خرید و فروش خودرو | eligible | exact | 3.1667 | — |
| H05B-03 | gacL14Hy | فروش سمند سورن | eligible | near | 0.8333 | — |
| H05B-04 | QZji3t1d | فروش کاتالیزور | eligible | near | 1.8333 | — |
| H05B-05 | gaXGdt9a | خریدار کاتالیزور ماشین | eligible | near | -0.8333 | — |
| H05B-06 | gaM76Zea | کاتالیزور ماشین سنگین | rejected | rejected | — | no-match |
| H05B-07 | QadoH4Gg | تعمیر اگزوز کاتالیزور | eligible | near | 2.1667 | — |
| H05B-08 | QaFK7cdB | فروش قطعات خودرو | rejected | rejected | — | kind:role:vehicle-part-not-vehicle |

The blind IDs map to the report's listing order. Do not use the engine result as a substitute for human grades.
