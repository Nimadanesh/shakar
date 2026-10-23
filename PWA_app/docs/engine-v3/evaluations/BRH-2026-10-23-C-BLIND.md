# Blinded Human Review Packet — Exchange Vehicle / Attribute Ownership

Packet ID: `BRH-2026-10-23-C`  
Status: awaiting independent judgments.  
Source: bounded, read-only live observation, run [39943428579](https://github.com/Nimadanesh/shakar/actions/runs/39943428579), captured 2026-10-23.  
Purpose: test whether a reviewer can reliably distinguish the vehicle offered in an ad from the requested exchange counterpart, and whether a condition claim is actually about the requested Samand. This is a two-ad diagnostic packet, not a relevance-quality estimate.

## Instructions

Use only the frozen text shown below; do not search for the ads online. Judge what the text explicitly says, not what seems likely. The offered vehicle is the one the advertiser currently has; the requested counterpart is the vehicle they want in exchange. A mention of a vehicle or an attribute is not evidence that the attribute belongs to every vehicle in the ad.

For each item, answer:
1. **Offered vehicle:** identify it, or write `نامشخص`.
2. **Requested exchange counterpart(s):** identify them, or write `نامشخص`.
3. **Does the description explicitly state that the requested Samand itself has paint/bodywork evidence?** Choose one: `بله`, `خیر؛ شاهدی ندارد`, or `متن مبهم است`.
4. **Which vehicle does the description's explicit paint/bodywork claim refer to?** Choose one: `وسیلهٔ پیشنهادی`, `سمندِ طرف معاوضه`, `خودروی دیگری`, or `هیچ شاهد صریحی نیست/مبهم`.

Do not infer the Samand's paint state from the offered vehicle's condition. If the title states a condition for the requested counterpart but the description's damage claim concerns the offered vehicle, keep those two facts separate.

---

## Item C01

**Title:** معاوضه با  خودرو رنگ سفید(سمند یا sd یا پرشیا )

**Description (frozen live-observation excerpt):**

> دوستان عزیز تخفیف خیلی کم هست به هیچ عنوان درخواست تخفیف بیشتر نکنید . موتور سیکلت معمولی شده ۳۰۰میلیون انتظار نداشته باشید ماشین سالم رو مفت بفروشم . ماشین خوب قیمتش کمی بالاتره ارزش داره خریدنش فنی عالی بیمه فول کولر یخ مدل ۸۴ دیسک و صفحه نو روغن تازه عوض شده فلومکس برای این مدل خوردگی دور از انتظار نیست سالمه و اینکه یک گلگیر عقب رنگ و یک کاپوت تعویض و مهمتر اینکه دور رنگ نیست معاوضه فقط و فقط با خودروهای سمند سفید یا ۲۰۶sd سفید و پرشیا سفید از مدل ۸۸ تا ۹۳ رنگ دیگه معاوضه ندارم . خدا شاهده قصد فروش ندارم . و خیلی خیلی ازش راضی هستم .فقط و فقط به خاطر رنگ ش می‌خوام معاوضه کنم .

**Judgment:**
- Offered vehicle: ____________________
- Requested counterpart(s): ____________________
- Samand itself has explicit paint/bodywork evidence in the description? ____________________
- Vehicle that the description's paint/bodywork claim refers to: ____________________
- Rationale (optional): ______________________________________________

---

## Item C02

**Title:** زانتیا ۲۰۰۰ معاوضه با سمند و پژو

**Description (frozen live-observation excerpt):**

> زانتیا ۲۰۰۰ همه چی سالم فقط موتور یه کم دود داره.شاسی ها سه تا سالم یکی صربه داره

**Judgment:**
- Offered vehicle: ____________________
- Requested counterpart(s): ____________________
- Samand itself has explicit paint/bodywork evidence in the description? ____________________
- Vehicle that the description's paint/bodywork claim refers to: ____________________
- Rationale (optional): ______________________________________________

---

## Return format

Please return:
- `C01: offered=...; requested=...; Samand-condition=...; claim-owner=...`
- `C02: offered=...; requested=...; Samand-condition=...; claim-owner=...`

The source IDs, rank, engine labels, and internal mapping are intentionally omitted from this packet. The two records are not independent samples from a population.
