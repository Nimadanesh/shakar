# Internal Mapping — BRH-2026-10-23-C

**Keep this file private until the blinded judgments have been returned.** Do not amend the blinded packet after grading starts.

Source workflow: bounded read-only Divar observation, 2026-10-23  
Run: [39943428579](https://github.com/Nimadanesh/shakar/actions/runs/39943428579)  
Observed source/config SHA: `a61658cba82621b0dbae3b263fcd8ae9b0bb2b59`

| Blind ID | Source ad ID | Exact title | Grounded source facts |
|---|---|---|---|
| C01 | `ga4iPfzH` | `معاوضه با  خودرو رنگ سفید(سمند یا sd یا پرشیا )` | The advertiser's offered vehicle is a motorcycle. The description says one rear fender is painted and the hood has been replaced; those claims concern the offered motorcycle. The title/description says exchange only for white Samand, Peugeot 206 SD, or Pars. Thus the offered vehicle's paint/bodywork claim must not be transferred to the requested Samand. |
| C02 | `galu34HS` | `زانتیا ۲۰۰۰ معاوضه با سمند و پژو` | The listed/offered vehicle is a 2000 Xantia. The title names Samand and Peugeot as exchange counterparts. The captured description says the Xantia's engine smokes a little and three chassis points are sound while one has impact damage; it provides no paint/bodywork evidence about the requested Samand. |

## Integrity / interpretation

- Both excerpts are copied from the run 116 log's `descriptionExcerpt` fields; no live-page refresh or paraphrased replacement was used.
- The packet asks about attribution, not overall search relevance, and is distinct from the previous 0–3 relevance grades.
- C01 is a clear opposite-side attribute trap; C02 is an unknown/missing target-attribute control. Neither is a target-side paint contradiction example.
- These judgments can improve confidence in the human evaluation protocol, but even a unanimous result does not create the missing clean contradiction case or authorize ranking integration.
- Keep `UNKNOWN` distinct from both support and contradiction. Do not alter production semantics, scoring, ranking, `main`, or deployment based on this packet alone.
