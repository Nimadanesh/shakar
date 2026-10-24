# Issue 16 — bounded cross-category capture results

Date: 2026-10-23
Status: **capture completed; human packet gate not met yet**
Scope: read-only live Divar retrieval only. This report records observed ads and engine diagnostics; it is not a relevance evaluation or a production-rank comparison.

## Run and budget

- Workflow run: [40008523406](https://github.com/Nimadanesh/shakar/actions/runs/40008523406)
- Artifact: `engine-v3-issue16-cross-category-capture`, ID `12525820038`
- Branch head used by run: `700aa17f4d13c3c9d75e7ea917ef615cae6b3e2b`; workflow checked out PR merge tree `c3ef12edab710790f567ebbb3251204f8d444e38`
- Capture timestamp: `2026-10-23T19:05:22.977Z` (observation time, not publication time)
- Limits respected: 3 scenarios; 2 list pages per scenario; 2 details per scenario; 6 details total; 6 unique IDs; `MIZAN_SHADOW=0`.
- The first workflow attempt timed out at Vitest's default 5-second test timeout before producing an artifact. The test timeout was raised to 120 seconds; the successful run above completed the capture test in about 15 seconds. No result is taken from the failed attempt.
- The same bounded test also executed on PR head `acddf26359b7d79ce7795776690f2a2b0dcd43ba` in [run 40008537573](https://github.com/Nimadanesh/shakar/actions/runs/40008537573) after a formatting-only follow-up commit. Treat that as a repeated execution of the same protocol, not an independent sample; the six-item findings below are recorded from run 40008523406.

## Observations

### 1. Refrigerator reference — query `فروشنده یخچال`

Two details from 50 ads seen / 50 candidates after filters:

- `gaqV1O58`, Tehran, 100,000,000: title `انواع یخچال ساید / سوخته خراب فروش وخریدار`; description `انواع یخچال ساید / سوخته خراب همه مدل برمیدارم فقط تماس☎️`. Engine kept it eligible as `near`, sample rank 1, score 0.5. It is a mixed/buyer-seeking reference, not a clean direct seller.
- `Qa4_oh_e`, Tehran, 100,000,000: title `معتبرترین‌لوازم خانگی فروشگاه عبادی ۴۰٪زیرقیمت`; long retail catalogue description. Engine rejected it as `no-match` under this query, sample rank unavailable.

This is a small reference sample only; it does not replace the prior human-graded refrigerator pair.

### 2. Vehicle mixed-title query — `خریدوفروش خودرو`

Two details from 49 ads seen / 48 candidates after filters:

- `gaIL7h0B`, Tabriz, 2,000,000,000: title `دفتر خریدوفروش حواله خودرو`; description `خرید و فروش حواله ماشین207،دنا،تارا،سورن و...`. Engine kept it eligible as `near`, sample rank 1, score 0.5.
- `gaPHaEfq`, Isfahan, 200,000,000: same title; description describes a transfer-office service for vehicle vouchers, includes buyer-paid transfer costs and asks interested owners to contact them. Engine kept it eligible as `near`, sample rank 2, score -3.5.

These are two distinct listings with the same title pattern, not two independent title-pattern types. The capture helper's diagnostic `titleRoleCue` mistakenly labelled `خریدوفروش` as seller-only because its buyer regex does not recognize the compact word `خریدوفروش` as a buyer-side cue. The preserved title and description snapshots take precedence over that helper label; do not use the label as ground truth.

### 3. Vehicle buyer query — `خریدار خودرو`

Two details from 50 ads seen / 50 candidates after filters:

- `gab_aV8W`, Tabriz, captured price 10,000: title `خودرو ام وی ام ۳۱۵ مدل96`; description says the owner has had the vehicle for three years, describes its accident/paint condition, and invites people to inspect it. Engine kept this seller-style listing eligible as `exact`, sample rank 1, score 3.5. This is a strong candidate for human review of a buyer-query role mismatch, but it is not yet a human judgment.
- `gavSad4q`, Bojnord, 530,000,000: title `یخچال زیرصفری برای ایسوزو ۵۲۰۰سازنده شرکت ماموت`; description offers an Isuzu refrigerated unit and says it may be exchanged for a vehicle. Engine rejected it as `kind:domain:appliance-not-vehicle`. It is a useful wrong-kind/exchange counterexample, not a clean buyer-seeking control.

**Gap result:** no explicit buyer-seeking vehicle ad was selected in this bounded two-page / two-detail sample. Record this as “not found within this bounded sample,” not as evidence that such ads do not exist.

## What this establishes — and does not

- The capture ran successfully within the declared request budget and preserved six unique real listings across home-appliance and vehicle categories.
- It exposes a likely role-direction false positive: a seller-style MVM listing is `exact` for `خریدار خودرو`. Human grading is still required.
- The vehicle mixed-title query returned two voucher-office listings, but only one compact `خریدوفروش` title pattern. This does not establish cross-category generalization by itself.
- The clean explicit buyer-seeking vehicle control remains missing. The current six-item capture is below Issue 16's 8–12 unique-listing blinded-packet target, and it should not be presented as satisfying that gate.
- No ranking rule, hard rejection, production allocation, or service state changed. Do not expand the mixed-title heuristic from this capture alone.

## Next gate

Preserve these six records. Do not repeat the same bounded refrigerator search merely to fill the packet. Before building a decision-grade 8–12 item blind packet, identify whether the existing frozen/ungraded source snapshots can supply additional **previously unjudged** candidates without reusing already graded listings. If they cannot, record the missing clean buyer control and stop this capture cycle; any new retrieval must be a separately specified bounded experiment. Keep the internal key separate from the blind packet.
