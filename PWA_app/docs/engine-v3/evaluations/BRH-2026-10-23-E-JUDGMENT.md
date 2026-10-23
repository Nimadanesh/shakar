# BRH-2026-10-23-E — Human judgment record

Source: Live Observation #126, https://github.com/Nimadanesh/shakar/actions/runs/39987342173
Blind packet: [BRH-2026-10-23-E-BLIND.md](BRH-2026-10-23-E-BLIND.md)

- **E01 = 0.** خریدار خالص است؛ برای «فروشنده یخچال» جهتش برعکس است.
- **E02 = 2.** فروش واقعی و صریح دارد، ولی دوطرفه است؛ محورش فقط فروش نیست.

This two-item diagnostic totals 2/6 (mean 1.0/3); it is not a representative precision/recall estimate.

## Interpretation
1. E01 is a human-confirmed wrong-direction false positive for a seller-seeking hunt.
2. E02's hard rejection is too strong for this query: it has explicit body-level sales evidence, but mixed focus warrants demotion below clean sellers rather than direct-seller treatment.
3. Keep these cases query-scoped. Do not globally reject buyer ads or globally accept mixed dealers.
4. Next, add paired regression tests: (a) pure buyer must rank below a clean seller for «فروشنده یخچال»; (b) mixed seller/buyer with explicit sale evidence remains eligible but ranks below clean seller; (c) generic «یخچال» behavior is preserved; (d) «خریدار یخچال» still favors actual buyers over exchange/direct-seller offers.
5. Acceptance gate: no new global hard rejection; behavior changes only under explicit seller-seeking intent; focused tests pass before any live replay. No production merge or deployment until reviewed.

The blind packet remains unchanged.