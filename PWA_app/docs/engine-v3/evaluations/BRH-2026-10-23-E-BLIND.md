# BRH-2026-10-23-E — Blind role-direction packet

## Purpose
A two-listing diagnostic from bounded read-only Live Observation #126. The hunt is **«فروشنده یخچال»**: find a seller offering a refrigerator. This is not a representative quality estimate and does not test overall precision/recall.

Grade each listing for this specific hunt:
- **3** = direct, clearly relevant seller offer
- **2** = relevant but materially indirect / mixed focus
- **1** = only weakly related
- **0** = wrong direction, wrong kind, or irrelevant
- **Unknown** = insufficient evidence to judge

Judge the ad's actual offer and direction from its title/body, not from any engine verdict. The packet intentionally omits source IDs, ranks, and engine labels.

---

### E01
**Title:** خریدار انواع یخچال ها سالم وخرابی قدیم وجدید

**Description:** شبانه روز آنلاین

### E02
**Title:** فروشنده و (خریدار)انواع مدل یخچال  کل کرج

**Description:** فروش وخریدار انواع مدل یخچال کاکرده و آکبند در کل کرج با بالاترین قیمت

---

Return one grade per ID and a short reason, especially whether the listing offers refrigerators for sale, seeks to buy them, or does both.
