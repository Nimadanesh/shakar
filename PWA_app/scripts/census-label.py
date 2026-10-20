#!/usr/bin/env python3
"""
Census labeling — Decision v2 sec.4.2 (one primary label per zero,
first match wins): 1 intent inversion/contract failure, 2 price,
3 city, 4 role, 5 absence-polarity, 6 wrong-kind, 7 wrong-item
same kind, 8 other.

Labels below were assigned by musi from the worksheet evidence
(hunt intent vs ad title/desc/Mizan kind), one reason string each.
This script only tallies — it does not label. Shares are ALWAYS on
the original denominator (sec.4.3: no residual recomputation).
"""
import json
from collections import Counter

# (worksheet index -> (label, reason))
LABELS = {
    0: (6, "شاستی (chassis part) on a car hunt — part, not the item"),
    1: (6, "کمپرسور کولر (part) on «پراید»"),
    2: (6, "بلبرینگ (part) on a Pride hunt"),
    3: (6, "قطعات مکانیکی پژو (parts) on a car hunt"),
    4: (6, "اجاره انبار سیلو — storage rental service, not the food item"),
    5: (6, "علف بادام زمینی — fodder/byproduct, not the food item"),
    6: (6, "سیستم ماشین — car audio (accessory) on a car hunt"),
    7: (8, "whole car (RD) — no accident evidence either way; no class 1-7 fires"),
    8: (6, "گاز ماشین — CNG part/kit on a car hunt"),
    9: (6, "پنل کولر ماشین سنگین — part on a car hunt"),
    10: (5, "whole car but «تازه تعمیر» — repair disclosed against a no-accident hunt"),
    11: (6, "سیستم ماشین — audio accessory on a car hunt"),
    12: (6, "جک ماشین سنگین — tool/part on a car hunt"),
    13: (6, "قطعات مکانیکی (parts) on a car hunt"),
    14: (6, "کلاف مبل — sofa frame (part) on a sofa hunt"),
    15: (5, "«وام جانبازی» in the title itself — the forbidden attribute is present on a «بدون وام» hunt"),
    16: (6, "گرانول/بنتونیت — detergent raw ingredient, not the detergent product"),
    17: (6, "لنت (brake pads, part) on a motorcycle hunt"),
    18: (6, "طلق (windshield, accessory) on a motorcycle hunt"),
    19: (6, "کفی ماشین (floor mat, accessory) on a car hunt"),
    20: (6, "دینام (alternator, part) on a car hunt"),
    21: (6, "چادر ماشین (cover, accessory) on a car hunt"),
    22: (7, "baking-supplies bundle (sesame/yeast; peanut slivers a minor ingredient) — wrong item, goods"),
    23: (6, "معجون کره بادام زمینی — processed/derived product on a raw-peanut hunt"),
    24: (6, "کره بادام زمینی — derived product on a raw-peanut hunt"),
    25: (6, "موتور ماشین لباسشویی (part) on a washing-machine hunt"),
    26: (6, "سیستم ماشین — audio accessory on a car hunt"),
    27: (5, "اسقاطی/فرسوده — scrapped, worn-out cars offered on a no-accident hunt; damage is the goods"),
    28: (8, "whole Tiba; repaint disclosed but hunt attribute is accident, no accident evidence — no class fires"),
    29: (6, "کفی ماشین (accessory) on a car hunt"),
    30: (5, "fabric «کمی کثیف شده» — soiling present against a no-stain hunt"),
    31: (6, "باربند (roof rack, accessory) on a pickup hunt"),
    32: (6, "طلق (accessory) on a motorcycle hunt"),
    33: (6, "لوازم موتور سیکلت (parts bundle) on a motorcycle hunt"),
    34: (8, "whole motorcycle (impound-lot, model 81) — no class 1-7 fires"),
    35: (4, "«میخام شاگرد ماشین سنگین بشم» — a person seeking work (demand side), not an ad for a vehicle"),
    36: (7, "peanut-shaped keychain — novelty goods, wrong item (repeats R9/R10/R11)"),
    37: (6, "تمامی متعلقات (parts bundle) on a washing-machine hunt"),
    38: (5, "desc: back panel cracked + LCD corner black — damage present on a no-scratch hunt"),
    39: (5, "desc: touch screen broken — damage present on a no-scratch hunt"),
    40: (6, "تعمیرات مبل — repair service on a sofa hunt"),
    41: (6, "لوازم موتور سیکلت (parts) on a motorcycle hunt"),
    42: (7, "پراید وانتی — pickup variant; founder's intent was the Pride car (same ad zeroed in H5 too)"),
    43: (6, "لوازم استوک (used parts) on a Pride hunt"),
    44: (7, "پراید وانتی — pickup variant on the seller hunt"),
    45: (6, "لوازم استوک (parts) on a Pride hunt"),
    46: (6, "کاربراتور (part) on a Pride hunt"),
    47: (6, "سپر (bumper, part) on a Pride hunt"),
    48: (7, "بیل مکانیکی/بلدزر — heavy machinery, wrong vehicle item (Mizan: whole)"),
    49: (4, "«ماشین های تصادفی» — a buyer demanding crashed cars (demand ad), not an offer"),
    50: (6, "لوازم ماشین و موتور (parts) on a car hunt"),
    51: (6, "کمپرسور کولر (part) on a car hunt"),
    52: (7, "peanut keychain — novelty goods, wrong item"),
    53: (7, "baking-supplies bundle — wrong item, goods"),
    54: (7, "کره‌گیری machine for sale — equipment, wrong item on a food hunt"),
    55: (6, "سیستم ماشین (accessory) on a car hunt"),
    56: (7, "heavy machinery — wrong vehicle item"),
    57: (4, "buyer demanding crashed cars (demand ad)"),
    58: (6, "لوازم (parts) on a car hunt"),
    59: (6, "کمپرسور (part) on a car hunt"),
    60: (5, "«فقط نیاز به شستشو داره» — soiling present against a no-stain hunt"),
    61: (4, "desc: «خریدار ایسیو هستم» — a wanted/demand ad for a part, not an offer"),
    62: (6, "ECU/computer (part) on a motorcycle hunt"),
    63: (6, "گیربکس + تعمیر (part/service) on a Pride hunt"),
    64: (6, "گیربکس + تعمیر (part/service) on a Pride hunt"),
    65: (5, "desc: «تمام رنگ، شاسی خورده» — full repaint + chassis damage present on a no-repaint hunt"),
    66: (8, "BMW 640i, whole car — no paint evidence either way; no class fires"),
    67: (6, "مانیتور ماشین (accessory) on a car hunt"),
    68: (6, "سیستم ماشین (accessory) on a car hunt"),
    69: (6, "لاستیک (tires, part) on a car hunt"),
    70: (7, "peanut keychain — novelty goods, wrong item"),
    71: (6, "کره‌گیری در حضور مشتری — butter-making service on a food hunt"),
    72: (6, "کره بادام زمینی (derived product) on a raw-peanut hunt"),
    73: (6, "کنجاله — oil-cake byproduct (derived) on a raw-peanut hunt"),
    74: (7, "store shelving/fixtures — wrong item entirely (keyword-stuffed title)"),
    75: (6, "بدنه ماشین لباسشویی (shell, part) on a washing-machine hunt"),
    76: (6, "دینام/موتور لباسشویی (part) on a washing-machine hunt"),
    77: (6, "چراغ/هدلایت (parts shop) on a car hunt"),
    78: (6, "لوازم یدکی (parts) on a car hunt"),
    79: (7, "ماشین قسطی — dealer installment program, not a specific car ad"),
    80: (6, "اجاره خودرو — rental service on a purchase hunt"),
    81: (7, "raw peanuts «for butter-making» — the ingredient, not peanut butter"),
    82: (7, "raw peanuts «for butter-making» — the ingredient, not peanut butter"),
}


def main():
    rows = json.load(open("/home/hatch/workspace/census-worksheet.json"))
    assert len(rows) == len(LABELS), f"{len(rows)} rows vs {len(LABELS)} labels"
    counts = Counter()
    per_round = {}
    for i, r in enumerate(rows):
        lab, reason = LABELS[i]
        r["label"] = lab
        r["labelReason"] = reason
        counts[lab] += 1
        per_round.setdefault(r["round"], Counter())[lab] += 1
    n = len(rows)
    p_contract = sum(counts[k] for k in (1, 2, 3, 4, 5)) / n
    p_kind = counts[6] / n
    p_item = counts[7] / n
    p_other = counts[8] / n
    print(f"n = {n}")
    for k in range(1, 9):
        print(f"  class {k}: {counts.get(k, 0)}  ({counts.get(k, 0)/n:.3f})")
    print(f"p_contract (1-5) = {p_contract:.3f}")
    print(f"p_kind (6)       = {p_kind:.3f}")
    print(f"p_item (7)       = {p_item:.3f}")
    print(f"p_other (8)      = {p_other:.3f}")
    print("\nper-round:")
    for rnd in sorted(per_round):
        c = per_round[rnd]
        m = sum(c.values())
        print(f"  {rnd}: n={m}  kind={c.get(6,0)} ({c.get(6,0)/m:.2f})  item={c.get(7,0)} ({c.get(7,0)/m:.2f})  contract={sum(c.get(k,0) for k in (1,2,3,4,5))}  other={c.get(8,0)}")
    with open("/home/hatch/workspace/census-labeled.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print("\nwrote /home/hatch/workspace/census-labeled.json")


if __name__ == "__main__":
    main()
