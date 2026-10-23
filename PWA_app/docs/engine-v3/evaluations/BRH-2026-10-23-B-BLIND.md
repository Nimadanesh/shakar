# Blinded Human Review Packet — Seller-Role vs Ordinary Refrigerator Search

Packet ID: `BRH-2026-10-23-B`  
Status: ready for independent grading; no grades recorded.  
Source: bounded live role-control observation artifact `engine-v3-role-regression-observation.json`, captured 2026-10-23.  
Purpose: determine whether the two observed candidates are genuinely relevant to seller-seeking intent, and whether their relevance changes under ordinary `یخچال` search. This is a four-judgment diagnostic pair, not a representative sample or a quality-uplift estimate.

## Instructions for evaluator

Grade each listing against the query exactly as written. Consider the transaction role expressed by the listing, not just the presence of the word «یخچال». For the seller-seeking query, a listing that only seeks to buy refrigerators or offers an exchange without clearly selling one should not receive an exact grade. For ordinary search, a relevant refrigerator listing may still be useful even if its transaction direction is mixed or unclear.

Rubric:
- **3 — دقیق:** clearly satisfies the query's product and transaction intent.
- **2 — مرتبط:** meaningfully relevant, but role, listing focus, or a key detail remains ambiguous.
- **1 — ضعیف:** only tangentially useful or substantially mismatched.
- **0 — نامرتبط:** wrong product or opposite transaction intent.
- **نامشخص — اطلاعات ناکافی:** the supplied text is insufficient for a reliable judgment; exclude from numeric metric denominators.

Grade from the frozen title and description excerpt only. Do not search these ads online. The packet omits source IDs, rank, engine labels, and engine reasoning. Some source listings intentionally appear under both queries because this is a paired query-intent check; grade each occurrence independently against its own query.

---

## Task A

**Query:** «فروشنده یخچال»

### B01
**Title:** خریدوفروش انواع یخچال سالم موتورسوخته پوسیده

**Description excerpt:**  
«خریدانواع یخچال سالم موتورسوخته پوسیده گازرفته بصورت توافقی»

**Grade:** ______  
**Reason (optional):** __________________________________

### B02
**Title:** فروش یخچال

**Description excerpt:**  
«معاوضه با برنج یا چلتوک، یا گوسفند زنده»

**Grade:** ______  
**Reason (optional):** __________________________________

---

## Task B

**Query:** «یخچال»

### B03
**Title:** فروش یخچال

**Description excerpt:**  
«معاوضه با برنج یا چلتوک، یا گوسفند زنده»

**Grade:** ______  
**Reason (optional):** __________________________________

### B04
**Title:** خریدوفروش انواع یخچال سالم موتورسوخته پوسیده

**Description excerpt:**  
«خریدانواع یخچال سالم موتورسوخته پوسیده گازرفته بصورت توافقی»

**Grade:** ______  
**Reason (optional):** __________________________________

---

## Return format

Return one grade per ID, e.g. `B01=1, B02=2, B03=3, B04=2`. Keep rationale separate from numeric grade.
