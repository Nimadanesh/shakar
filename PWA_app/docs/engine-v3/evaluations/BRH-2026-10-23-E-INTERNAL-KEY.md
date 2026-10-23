# BRH-2026-10-23-E — Internal source key (do not show before blind grades)

Source: Live Observation #126, run https://github.com/Nimadanesh/shakar/actions/runs/39987342173, commit c9e9dac45dd5e5514c8caf2ba676608df27a2e68.

Query: «فروشنده یخچال», resolved roleMode=seek-seller. Two detail reads selected from 194 candidates across 8 pages. MIZAN_SHADOW=0. This packet is a fresh diagnostic, not a paired quality comparison.

- E01 = sourceAdId `gadGy2CS`, live title `خریدار انواع یخچال ها سالم وخرابی قدیم وجدید`; detail excerpt only `شبانه روز آنلاین`. Listing role in observation: buyer-seeking. It was retained as exact, score 3.5, rank 1. This is a potential wrong-direction inclusion; the short detail excerpt limits certainty.
- E02 = sourceAdId `gaIiDKN5`, live title `فروشنده و (خریدار)انواع مدل یخچال  کل کرج`; description `فروش وخریدار انواع مدل یخچال کاکرده و آکبند در کل کرج با بالاترین قیمت`. It was rejected as `dealer-mixed:offering:"فروشنده خریدار"`. This is a potential false rejection because the body explicitly says both sells and buys refrigerators.

Guardrails:
- Do not change production ranking/eligibility from these two records alone.
- Keep the blind packet unchanged after grades; put owner grades/reasons in a separate judgment record.
- If E01 is graded 0 and E02 is graded 2/3, add a narrowly scoped regression that seller-seeking should demote buyer-only ads while preserving mixed listings with explicit seller evidence. Avoid a global mixed-title hard rejection or a global buyer-seeking hard rejection.
- If grades differ, analyze that evidence before choosing a technical response.
- No main merge, deployment, or frozen-evaluation edits.
