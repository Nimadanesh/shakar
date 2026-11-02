# GOLDEN — سنجش خودکار روی مجموعه طلایی (۱۰ شکار × ۲۰ عنوان)

سنجش صرف است، نه دروازه: هیچ عددی در این گزارش تست را قرمز نمی‌کند.
روش: برای هر شکار جمله با resolveHuntDefinition حل شد، پاسخ رفع ابهام با همان مسیر محصول (POST transaction/condition ← HuntDefinition) اعمال شد، سپس pipeline با provider ماک روی ۲۰ آگهی همان شکار اجرا شد.
حالت A: توضیح = عنوان، categorySlug خالی. حالت B: توضیح نامعلوم — در موتور یعنی getDetail stale، پس detailUnknown و توضیح خالی.
ردیف از trace مرحله T خوانده شد. آگهی بدون trace در فاز تیتر رد شده است (پیش‌نامزد) و با دلیل title-exclude ردیف ۴ ثبت شد.
ردیف‌های ویژه در جدول‌ها آمده‌اند ولی در هیچ عدد کل شمرده نشده‌اند: city-filter (شکار ۶ ردیف‌های ۱، ۴، ۵ — ماک فیلتر شهر اعمال نمی‌کند) و borderline (ردیف‌های دارای «؟»: شکار ۳ ردیف ۱۷، شکار ۶ ردیف ۳، شکار ۸ ردیف ۲). شکار ۷ فقط با سناریو الف خوانده شد.
تعریف‌ها: نشت = نمره مالک ۴ ولی نمایش‌داده‌شده (ردیف ۱ تا ۳). گم‌شده = نمره مالک ۱ یا ۲ ولی ردیف ۴ یا hidden. توافق دقیق و ±۱ فقط روی ردیف‌های دارای عدد ردیف حساب شده‌اند؛ hidden عدد ندارد، پس از مخرج توافق کنار است ولی در گم‌شده (اگر نمره ۱ یا ۲ باشد) شمرده می‌شود. ماتریس هم فقط ردیف‌های دارای عدد را دارد.
قیمت: سقف/کف قیمت در موتور همیشه فیلتر سخت فاز 3b است (آگهی با قیمت نامعلوم می‌ماند)؛ «ترجیحاً زیر X» از HANDOFF-5 به سقف نرم preferredPriceMax می‌رود و فیلتر سخت نمی‌سازد (فاز 3f هنوز آن را نخوانده است).

## جمع‌بندی کل

| حالت | ردیف‌های شمرده‌شده | نمایش‌داده‌شده | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول (مجموع شکارها) | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 194 | 134 | 60 | 0 | 11 | 1 | 58.8% (114/194) | 86.1% (167/194) | 24 | 14.4% (141/981) |
| B | 194 | 134 | 60 | 0 | 11 | 1 | 46.9% (91/194) | 72.7% (141/194) | 22 | 14.7% (144/981) |

ردیف‌های ویژه (خارج از عددهای کل): 6 عدد — city-filter: 3، borderline: 3.

## عددهای تازه — HANDOFF-K

نمره ۳ پنهان‌شده (نمره مالک ۳ ولی ردیف ۴ یا hidden، فقط ردیف‌های شمرده‌شده): حالت A: 11، حالت B: 11.
نشت با طعمه قبول‌شده / بدون آن (شکار ۴ ردیف‌های ۱۲ و ۲۰ طعمه قبول‌شده‌اند، طبق تصمیم مالک ردیف ۳): حالت A: 11 / 9، حالت B: 11 / 9.

یادداشت مالک (HANDOFF-K، اصلاح ۴): نمره ۳ داخل JSON طلایی برای شکار ۷ ردیف‌های ۱ و ۴ قدیمی است — هر دو آگهی فقط‌اجاره‌اند و در شکار خرید همیشه ردیف ۴ می‌شوند (تصمیم مالک: آگهی فقط‌اجاره در شکار خرید همیشه ردیف ۴ است). JSON دست نخورده و این دو ردیف از قانون «هیچ نمره ۱ تا ۳ پایین نرود» مستثنا هستند.
شکارهای ۵ و ۷ با transaction=buy در اجراکننده اجرا شدند (اصلاح ۳) — همان پاسخ «خرید یا اجاره» در JSON طلایی، بدون تغییر JSON.

### ماتریس کل — حالت A (سطر = نمره مالک، ستون = ردیف موتور)

| نمره مالک \ ردیف موتور | ۱ | ۲ | ۳ | ۴ |
|---|---|---|---|---|
| 1 | 23 | 3 | 26 | 0 |
| 2 | 4 | 0 | 24 | 1 |
| 3 | 0 | 0 | 43 | 11 |
| 4 | 0 | 0 | 11 | 48 |

### ماتریس کل — حالت B

| نمره مالک \ ردیف موتور | ۱ | ۲ | ۳ | ۴ |
|---|---|---|---|---|
| 1 | 0 | 0 | 52 | 0 |
| 2 | 0 | 0 | 28 | 1 |
| 3 | 0 | 0 | 43 | 11 |
| 4 | 0 | 0 | 11 | 48 |

## شکار 1: موتورسیکلت هوندا

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «موتورسیکلت هوندا».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PCX ADV160 CLICK160 HONDA STYLO160هوندا استایلو۱۶۰ | 1,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 2 | هوندا ۱۲۵ | 112,000,000 | تهران | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 3 | طرح وسپا دایچی jp150 هوندا ۱۲۵ هوندا ۲۰۰ | 295,000,000 | اصفهان | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 4 | فروش cbr600زیر قیمت ایران | 695,000,000 | قائم‌شهر | 2 | — | 4 | no-match | 4 | no-match |
| 5 | رهرو | 200,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 6 | هوندا فورزا ۳۵۰.  مدل ۴۰۵. | 4,100,000,000 | تهران | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 7 | موتور هندا مزایده | 38,000,000 | احمدآبادمستوفی | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 8 | موتور هوندا و مگلی طرح رپسول زیر قیمت | 140,000,000 | مرودشت | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 9 | موتور سیوان شکاری 150سی سی  هندا اپاچی تریل | 120,000,000 | نسیم‌شهر | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 10 | نیکتاز 250 رنگ خاص | 235,000,000 | فیروزآباد (فارس) | 4 | — | 4 | no-match | 4 | no-match |
| 11 | موتور هندا ۱۲۵ اروین | 140,000,000 | ملارد | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 12 | هندا شهباز 125 پنج دنده 92 | 118,000,000 | چابکسر | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 13 | موتور هندا ۱۲۵ | 55,000,000 | امیدیه | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 14 | موتور هوندا | 135,000,000 | رباط‌کریم | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 15 | موتور تریل بهرو یا فلات طرح کی تی ام | 380,000,000 | قم | 4 | — | 4 | no-match | 4 | no-match |
| 16 | موتور هوندا کلیک ۱۵۰ اصلی اندونزی | 780,000,000 | مشهد | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 17 | طرح ویو احسان | 310,000,000 | تهران | 4 | — | 4 | no-match | 4 | no-match |
| 18 | موتور دیگری ۲۵۰ | 410,000,000 | تهران | 4 | — | 4 | no-match | 4 | no-match |
| 19 | موتور هوندا 200 کبیر مدل ۹۷ | 135,000,000 | کلاچای | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 20 | موتور پرواز ۲۰۰ ۱۴۰۲ | 180,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 13 | 7 | 0 | 1 | 1 | 30.0% (6/20) | 50.0% (10/20) | 3 | 39.7% (31/78) |
| B | 20 | 13 | 7 | 0 | 1 | 1 | 30.0% (6/20) | 50.0% (10/20) | 3 | 39.7% (31/78) |
نمره ۳ پنهان‌شده: A: 0، B: 0. نشت بدون طعمه قبول‌شده: A: 1، B: 1.

ماتریس شکار 1 — حالت A (سطر = نمره مالک):

- نمره 1: 0، 0، 9، 0
- نمره 2: 0، 0، 3، 1
- نمره 3: 0، 0، 0، 0
- نمره 4: 0، 0، 1، 6
ماتریس شکار 1 — حالت B:

- نمره 1: 0، 0، 9، 0
- نمره 2: 0، 0، 3، 1
- نمره 3: 0، 0، 0، 0
- نمره 4: 0، 0، 1، 6

## شکار 2: دنا پلاس

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «دنا پلاس».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | دنا پلاس توربو ۱۴۰۲در حد صفر | 3,240,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 2 | دنا پلاس اتومات توربو اپشنال | 3,730,000,000 | کرج | 1 | — | 1 |  | 3 | detail-unknown |
| 3 | دنا پلاس توربو کم کار | 2,950,000 | مشهد | 1 | — | 3 | price:implausible | 3 | detail-unknown، price:implausible |
| 4 | دنامدل۹۶ | 1,770,000,000 | بوشهر | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 5 | دنا پلاس اتومات | 3,450,000,000 | منجیل | 1 | — | 1 |  | 3 | detail-unknown |
| 6 | حواله دنا پلاس | 30,000,000 | تهران | 4 | — | 4 | part:title-offering:"حواله" | 4 | part:title-offering:"حواله" |
| 7 | فروش دنا اتومات ۱۴۰۲ | 3,100,000,000 | خمیر | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 8 | دنا پلاس خشک واقعی | 2,410,000,000 | کرمانشاه | 1 | — | 1 |  | 3 | detail-unknown |
| 9 | دنا پلاس آپشنال | 1,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 10 | دنا معمولی تیپ 2فول کم کار | 1,960,000 | اسلام‌شهر | 2 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 11 | حواله دناپلاس | 120,000,000 | شیراز | 4 | — | 4 | part:title-offering:"حواله" | 4 | part:title-offering:"حواله" |
| 12 | دنا پلاس اتوماتیکEF7 توربو آپشنال مدل 1404 | 3,830,000,000 | بهبهان | 1 | — | 1 |  | 3 | detail-unknown |
| 13 | حواله دنا پلاس | 55,000,000 | همدان | 4 | — | 4 | part:title-offering:"حواله" | 4 | part:title-offering:"حواله" |
| 14 | دنا پلاس ۶ دنده صفر ۱۴۰۵ | 3,400,000,000 | شیراز | 1 | — | 1 |  | 3 | detail-unknown |
| 15 | دنا پلاس اتوماتیک ابشنال مدل 1403 | 3,680,000,000 | اراک | 1 | — | 1 |  | 3 | detail-unknown |
| 16 | دنا 6دنده مدل1402 | 3,100,000,000 | رباط‌کریم | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 17 | دنا پلاس توربو اتومات آپشنال | 4,070,000,000 | کرج | 1 | — | 1 |  | 3 | detail-unknown |
| 18 | دنا اپشنال | 3,550,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 19 | دنا پلاس ساندروف دار مدل 97 | 2,600,000,000 | همدان | 1 | — | 1 |  | 3 | detail-unknown |
| 20 | دناپلاس ۶دنده بارینگ‌ صفرخشک روز مدل ۱۴۰۵ | 3,400,000,000 | دزفول | 1 | — | 1 |  | 3 | detail-unknown |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 17 | 3 | 0 | 0 | 0 | 70.0% (14/20) | 95.0% (19/20) | 5 | 0.0% (0/136) |
| B | 20 | 17 | 3 | 0 | 0 | 0 | 15.0% (3/20) | 40.0% (8/20) | 5 | 0.0% (0/136) |
نمره ۳ پنهان‌شده: A: 0، B: 0. نشت بدون طعمه قبول‌شده: A: 0، B: 0.

ماتریس شکار 2 — حالت A (سطر = نمره مالک):

- نمره 1: 11، 0، 1، 0
- نمره 2: 0، 0، 5، 0
- نمره 3: 0، 0، 0، 0
- نمره 4: 0، 0، 0، 3
ماتریس شکار 2 — حالت B:

- نمره 1: 0، 0، 12، 0
- نمره 2: 0، 0، 5، 0
- نمره 3: 0، 0، 0، 0
- نمره 4: 0، 0، 0، 3

## شکار 3: نینتندو سوییچ

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «نینتندو سوییچ».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | نینتندو سوییچ لایت مرجانی کپی‌خور با ۴۵ بازی خاص | 77,000,000 | اهواز | 1 | — | 2 | sibling-variant:listing-adds:"لایت" | 3 | detail-unknown، sibling-variant:listing-adds:"لایت" |
| 2 | نینتندو سوییچ اولد کپیخور | 95,000,000 | کرج | 1 | — | 1 |  | 3 | detail-unknown |
| 3 | نینتندو سوییچ اولد بسیار سالم با 25 تا بازی | 74,000,000 | کرج | 1 | — | 1 |  | 3 | detail-unknown |
| 4 | بازی Super Mario Odyssey برای نینتندو سوییچ ۱ | 9,000,000 | مشهد | 4 | — | 4 | kind:game-for-console | 4 | kind:game-for-console |
| 5 | نینتندو سوییچ اولد در حد صفر | 70,000,000 | امیدیه | 1 | — | 1 |  | 3 | detail-unknown |
| 6 | Minecraft Nintendo switch نینتندو سویچ | 5,000,000 | تهران | 4 | — | 3 | price:implausible | 3 | detail-unknown، price:implausible |
| 7 | بازی اسپرت نینتندو سویچ | 7,000,000 | تهران | 4 | — | 4 | kind:game-for-console | 4 | kind:game-for-console |
| 8 | نینتندو سویچ اولد | 75,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 9 | نینتندو سوییچ باندل مانستر هانتر | 55,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 10 | نینتندو سوییچ Lite کپی خور استوک 512GB | 49,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 11 | Nintendo switch نینتندو سوییچ | 50,000 | تهران | 1 | — | 3 | price:implausible | 3 | detail-unknown، price:implausible |
| 12 | فروش فوق العاده نینتندو سوییچ | 40,000 | اهواز | 1 | — | 3 | price:implausible | 3 | detail-unknown، price:implausible |
| 13 | پلی1فت)بازیCDسوییچ۴نینتندوps2میکرو۵نصبps3یکproسونی | 1,000 | تهران | 4 | — | 4 | no-match | 4 | no-match |
| 14 | نینتندو سویچ لایت (کنسول دستی) | 45,000,000 | تهران | 1 | — | 2 | sibling-variant:listing-adds:"لایت" | 3 | detail-unknown، sibling-variant:listing-adds:"لایت" |
| 15 | کنسول بازی نیتندو سوییچ لایت | 40,000,000 | تهران | 1 | — | 2 | sibling-variant:listing-adds:"لایت" | 3 | detail-unknown، sibling-variant:listing-adds:"لایت" |
| 16 | خریدفروش خدمات نینتندو سوییچ Nintendoبازی نصبشده | 25,000,000 | تهران | 4 | — | 4 | kind:service-head | 4 | kind:service-head |
| 17 | هر سه باهم نینتندو اولد،لیمیتد مانستر هانتر،دو | 220,000,000 | نوشهر | 2 | borderline | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 18 | فروش خدمات نینتندو سوییچ Nintendo PS5 بازی نصبشده | 1,500,000 | تهران | 4 | — | 4 | kind:service-head | 4 | kind:service-head |
| 19 | بازی fc 26 برای نینتندو سوییچ ۲ | 4,500,000 | اهواز | 4 | — | 4 | kind:game-for-console | 4 | kind:game-for-console |
| 20 | فروش خدمات نینتندو سوییچ Nintendo PS5 بازی نصبشده | 1,000,000 | تهران | 4 | — | 4 | kind:service-head | 4 | kind:service-head |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 19 | 12 | 7 | 0 | 1 | 0 | 68.4% (13/19) | 89.5% (17/19) | 5 | 6.1% (4/66) |
| B | 19 | 12 | 7 | 0 | 1 | 0 | 36.8% (7/19) | 42.1% (8/19) | 4 | 10.6% (7/66) |
نمره ۳ پنهان‌شده: A: 0، B: 0. نشت بدون طعمه قبول‌شده: A: 1، B: 1.

ماتریس شکار 3 — حالت A (سطر = نمره مالک):

- نمره 1: 6، 3، 2، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 0، 0
- نمره 4: 0، 0، 1، 7
ماتریس شکار 3 — حالت B:

- نمره 1: 0، 0، 11، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 0، 0
- نمره 4: 0، 0، 1، 7

## شکار 4: آیفون 15 پرو یا پرومکس ۲۵۶ میخوام تا ۹۰ میل

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «آیفون 15 پرو».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ایفون 15پرومکس 256 15promax | 215,000,000 | تهران | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 2 | ۱۵ پرومکس با رجیستر اصلی | 329,000,000 | یزد | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 3 | ایفون ۱۵ پرو رجیستر پک اصلی بدون نقطه | 280,000,000 | کرج | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 4 | ۱۴ پرو مکس قابل معاوضه با ۱۵ پرو مکس | 175,000,000 | ارومیه | 4 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 5 | iphone 15 pro max | 340,000,000 | اردبیل | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 6 | آیفون ۱۵پرومکس | 240,000,000 | میامی | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 7 | آیفون ۱۵پرومکس باتری 98 | 240,000,000 | گرگان | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 8 | ایفون 15مکس | 243,000,000 | دزفول | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 9 | ایفون ۱۵ پرو ۲۵۶ zaa | 220,000,000 | گنبد کاووس | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 10 | 15 promax معاوضه با ipad | 250,000,000 | شیراز | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 11 | ایفون ۱۵ پرومکس حافظه ۲۵۶ iphone 15 pro max | 322,000,000 | تهران | 3 | — | 3 | sibling-variant:listing-adds:"پرومکس"، price:out-of-range | 3 | detail-unknown، sibling-variant:listing-adds:"پرومکس"، price:out-of-range |
| 12 | آیفون ۱۵پرو مکس | 20,000,000 | اراک | 4 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 13 | انواع آیفون iphone قسطی + 24 ماه بدون پیش واقعی | 69,000,000 | کرمان | 4 | — | 4 | kind:store-listing | 4 | kind:store-listing |
| 14 | آیفون 15پرومکس | 150,000,000 | اهواز | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 15 | ایفون ۱۵ پرومکس iphone 15 max | 320,000,000 | مشهد | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 16 | 15 pro max | 168,000,000 | اهواز | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 17 | مدل های جدید آیفون | 17,000,000 | قروه | 4 | — | 4 | kind:store-listing | 4 | kind:store-listing |
| 18 | Iphone 15 Promax | 220,000,000 | کرمان | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 19 | انواع آیفون موجود است | 17,000,000 | خمینی‌شهر | 4 | — | 4 | kind:store-listing | 4 | kind:store-listing |
| 20 | آیفون ۱۵پرو | 20,000,000 | کرمان | 4 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 17 | 3 | 0 | 3 | 0 | 85.0% (17/20) | 100.0% (20/20) | 0 | 2.2% (3/136) |
| B | 20 | 17 | 3 | 0 | 3 | 0 | 85.0% (17/20) | 100.0% (20/20) | 0 | 2.2% (3/136) |
نمره ۳ پنهان‌شده: A: 0، B: 0. نشت بدون طعمه قبول‌شده: A: 1، B: 1.

ماتریس شکار 4 — حالت A (سطر = نمره مالک):

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 14، 0
- نمره 4: 0، 0، 3، 3
ماتریس شکار 4 — حالت B:

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 14، 0
- نمره 4: 0، 0، 3، 3

## شکار 5: آپارتمان دوخوابه مشهد تا ۳ میلیارد

پاسخ رفع ابهام: transaction=buy. پرسمان جذب عنوان: «آپارتمان مشهد».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | مجموعه 440 متری.جنوبی.سند ملکی | 147,000,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 2 | هتل آپارتمان مشهد | 400,000 | مشهد | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 3 | ۸۰آسانسوپارکینگ نوساز هدایت موسوی قوچانی عبدالمطلب | 5,790,000,000 | مشهد | 3 | — | 4 | no-match | 4 | no-match |
| 4 | هتل آپارتمان مجلل ضیاء زاده | 700,000 | مشهد | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 5 | سوییت شاندیز ابرده رودخونه | 400,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 6 | آپارتمان همکف بدون مزاحمت | 200,000 | مشهد | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 7 | رهن کامل/ صیاد ۴۴/ صد متری / دو خواب | 1,000,000,000 | مشهد | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 8 | آپارتمان شیک/ اوایل رحمانیه/سند آماده | 12,800,000,000 | مشهد | 3 | — | 3 | partial-evidence، price:out-of-range | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 9 | برج باغ(هتلینگ) | 60,000,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 10 | خانه  جیم آباد شیک وتمیز | 3,150,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 11 | خانه | 4,500,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 12 | برج باغ ۵ستاره کیمیا | 26,000,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 13 | رهن کامل | 1,500,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 14 | دنبال همخونه فوری | 15,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 15 | اجاره آپارتمان ۹۰ متری وکیل آباد بلوار شهید قانع | 300,000,000 | مشهد | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 16 | ۱۱۷متری آسانسوردار دوم شاهد | 14,200,000,000 | مشهد | 3 | — | 4 | no-match | 4 | no-match |
| 17 | ۱۷۰ متر تک واحدی/پارکینگ اختصاصی/عرصه زمین ۲۰۰ متر | 11,550,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 18 | ۱۵۵ متر مدرس // قبل فرهنگ // شکار | 43,500,000,000 | مشهد | 3 | — | 4 | no-match | 4 | no-match |
| 19 | اجاره سوییت سوئیت سویت مبله سوعیت | 1,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |
| 20 | منزل رهن اجاره طبقه دوم روی پیلوت | 70,000,000 | مشهد | 4 | — | 4 | no-match | 4 | no-match |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 2 | 18 | 0 | 1 | 0 | 80.0% (16/20) | 100.0% (20/20) | 0 | 100.0% (1/1) |
| B | 20 | 2 | 18 | 0 | 1 | 0 | 80.0% (16/20) | 100.0% (20/20) | 0 | 100.0% (1/1) |
نمره ۳ پنهان‌شده: A: 3، B: 3. نشت بدون طعمه قبول‌شده: A: 1، B: 1.

ماتریس شکار 5 — حالت A (سطر = نمره مالک):

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 1، 3
- نمره 4: 0، 0، 1، 15
ماتریس شکار 5 — حالت B:

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 1، 3
- نمره 4: 0، 0، 1، 15

## شکار 6: یه ماشین اتومات خانوادگی اصفهان میخوام

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «ماشین اتومات اصفهان».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ام وی ام 110 اتوماتیک چهارسیلندر، مدل 90 | 600,000,000 | اهواز | 4 | city-filter | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 2 | ۲۰۷ اتومات مدل ۴۰۳ قابل معاوضه(اتومتین فرد) | 3,500,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 3 | لونا تمام برق پیمایش۴۲۰km و۵۰۰هزار گارانتی۱۶۵سرعت | 6,000,000,000 | اصفهان | 3 | borderline | 4 | no-match | 4 | no-match |
| 4 | میتسوبیشی asx2012 | 4,230,000,000 | تهران | 4 | city-filter | 4 | no-match | 4 | no-match |
| 5 | جک s3 اتوماتیک مدل ۹۷ | 1,750,000,000 | تهران | 4 | city-filter | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 6 | دنا پلاس اتوماتیک اپشنال ۱۴۰۴ | 3,700,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 7 | BMW X3 | 9,890,000,000 | اصفهان | 3 | — | 4 | no-match | 4 | no-match |
| 8 | اتوطاووس 207 اتومات ارتقا 1403 | 10,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 9 | شاهین پلاس اتومات ۱۴۰۴ در حد صفر *اتوعلیخانی* | 4,000,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 10 | دنا پلاس اتومات آپشنال سفید و مشکی و تیتانیوم | 4,500,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 11 | پژو ۲۰۷ پانا اتوماتیک مدل ۱۴۰۲ مشابه صفر | 3,799,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 12 | پژو 207i پانوراما اتومات TU5P(مدل۱۴۰۵)AutoLand | 4,550,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 13 | فروش و معاوضه دنا اتوماتیک آپشنال اقساط(اتو رایان) | 3,800,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 14 | فروش یا معاوضه کیا ریو ۸۸ اتومات فابریک اقساط | 1,250,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 15 | ثبت نام قطعی آریسان 2 بدون قرعه کشی نمایندگی 2063 | 2,020,000,000 | اصفهان | 4 | — | 4 | no-match | 4 | no-match |
| 16 | تارا وی 4 ال ایکس TU5P مدل ۱۴۰۴ در حد صفر | 3,800,000,000 | اصفهان | 3 | — | 4 | no-match | 4 | no-match |
| 17 | ورنا اتومات ۱۶۰۰  فروش فوری | 1,590,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 18 | 207 فلز اتوماتیک تمیز خونگی | 3,800,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 19 | دنااپشنال اتومات مدل ۱۴۰۳ | 3,550,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 20 | دناپلاس  اتومات آپشنال مدل ۱۴۰۳ | 3,600,000,000 | اصفهان | 1 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 16 | 13 | 3 | 0 | 0 | 0 | 6.3% (1/16) | 18.8% (3/16) | 5 | 0.0% (0/78) |
| B | 16 | 13 | 3 | 0 | 0 | 0 | 6.3% (1/16) | 18.8% (3/16) | 5 | 0.0% (0/78) |
نمره ۳ پنهان‌شده: A: 2، B: 2. نشت بدون طعمه قبول‌شده: A: 0، B: 0.

ماتریس شکار 6 — حالت A (سطر = نمره مالک):

- نمره 1: 0، 0، 13، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 0، 2
- نمره 4: 0، 0، 0، 1
ماتریس شکار 6 — حالت B:

- نمره 1: 0، 0، 13، 0
- نمره 2: 0، 0، 0، 0
- نمره 3: 0، 0، 0، 2
- نمره 4: 0، 0، 0، 1

## شکار 7: ویلا شیراز حیاط دار

پاسخ رفع ابهام: transaction=buy. پرسمان جذب عنوان: «ویلا شیراز».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | کد اگهی 920 ، فول امکانات آبگرم ، تیم رنت گاردن | 1,000 | شیراز | 3 | — | 4 | no-match | 4 | no-match |
| 2 | سراج پاسارگاد تایمی روزانه سویت ویلایی پاسخگو ۲۴ | 500,000 | شیراز | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 3 | فروش باغ شهری قلات | 6,000,000,000 | شیراز | 3 | — | 4 | no-match | 4 | no-match |
| 4 | اجاره ویلایی 3 خوابه | 500,000,000 | شیراز | 3 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 5 | باغ 9000متری | 20,000,000,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 6 | اجاره اتاق 6متری وحیاط برای پارکینگ در مرکزشهر | 20,000,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 7 | دوطبق نوساز  کوشکک کوچه ۸۳ | 9,800,000,000 | شیراز | 3 | — | 4 | no-match | 4 | no-match |
| 8 | اپارتمان مبله لوکس | 3,500,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 9 | خونه ویلایی ساده وزیبا یا س وج برفی | 6,000,000,000 | شیراز | 2 | — | 1 | missing-should | 3 | detail-unknown، missing-should |
| 10 | منزل مبله خانه مسافر سوییت خانه ویلایی ساعتی تایمی | 850,000 | شیراز | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 11 | فروش خانه ویلایی | 27,000,000,000 | شیراز | 2 | — | 1 | missing-should | 3 | detail-unknown، missing-should |
| 12 | فروش باغ هماشهر همایجان سپیدان با لوکشن عالی | 4,000,000,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 13 | باغ سیاخ | 1,000,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 14 | فروش منزل ویلای واقع در کرونی با سند تک برگ | 5,900,000,000 | شیراز | 1 | — | 1 | missing-should | 3 | detail-unknown، missing-should |
| 15 | رنت کوتاه مدت منزل آپارتمان مبله لاکچری | 1,900,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 16 | فروش ویلایی130متری2خوابه میعادقصرقمشه | 8,000,000,000 | شیراز | 2 | — | 1 | missing-should | 3 | detail-unknown، missing-should |
| 17 | فروش زمین باغ‌شهری قطعه‌بندی | 550,000,000 | شیراز | 4 | — | 4 | no-match | 4 | no-match |
| 18 | ویلایی 4خوابه،طبقه دوم،ورودی مستقل ،حر | 400,000,000 | شیراز | 3 | — | 3 | missing-should، price:implausible | 3 | detail-unknown، missing-should، price:implausible |
| 19 | ویلا مبله دربست/یکخواب/سوئیت/تازه تجهیز/ اَمن | 800,000 | شیراز | 4 | — | 4 | transaction:rent-only | 4 | transaction:rent-only |
| 20 | منزل ویلای در جمال اباد کفترک | 5,000,000,000 | شیراز | 1 | — | 1 | missing-should | 3 | detail-unknown، missing-should |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 6 | 14 | 0 | 0 | 0 | 65.0% (13/20) | 100.0% (20/20) | 2 | 33.3% (5/15) |
| B | 20 | 6 | 14 | 0 | 0 | 0 | 55.0% (11/20) | 90.0% (18/20) | 1 | 40.0% (6/15) |
نمره ۳ پنهان‌شده: A: 4، B: 4. نشت بدون طعمه قبول‌شده: A: 0، B: 0.

ماتریس شکار 7 — حالت A (سطر = نمره مالک):

- نمره 1: 2، 0، 0، 0
- نمره 2: 3، 0، 0، 0
- نمره 3: 0، 0، 1، 4
- نمره 4: 0، 0، 0، 10
ماتریس شکار 7 — حالت B:

- نمره 1: 0، 0، 2، 0
- نمره 2: 0، 0، 3، 0
- نمره 3: 0، 0، 1، 4
- نمره 4: 0، 0، 0، 10

## شکار 8: تخت خواب دونفره چوبی میخوام در تهران باشه حتما سالم نه رنگ پریده ترجیحا زیر ده میل

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «تخت خواب».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | تختخواب باکس جکدار هتلی/ دوتکه و یه تکه (oxa home) | 20,000,000 | یافت‌آباد | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 2 | تخت دونفره | 15,000 | نارمک جنوبی | 3 | borderline | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 3 | سرویس خواب دونفره کامل درحد | 35,000,000 | علی‌آباد | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 4 | تخت و کمد کودک. تخت مناسب تا نوجوانی | 15,000,000 | چهارصد دستگاه | 4 | — | 4 | no-match | 4 | no-match |
| 5 | مدل 256 | 16,000,000 | یافت‌آباد | 3 | — | 4 | no-match | 4 | no-match |
| 6 | تخت خواب کمجا تاشو مدل رویال | 9,980,000 | یافت آباد جنوبی | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 7 | تخت باکسی | 6,000,000 | هاشمی | 3 | — | 4 | no-match | 4 | no-match |
| 8 | سرویس خواب نوزاد تا نوجوان برند mother baby | 28,000,000 | سعادت‌آباد | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 9 | تخت و سرویس خواب پارچه‌ای کد ۹۹ | 18,000,000 | شهرک شریفی | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 10 | سرویس خواب تخت و کتابخانه ( میز ارایش یا میز تحریر | 42,000,000 | باشگاه نفت | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 11 | تخت یکنفره جنس خوب بدون خط خش فرش شکی 4متری | 1,000 | تهرانپارس غربی | 4 | — | 4 | no-match | 4 | no-match |
| 12 | تخت دو نفره با دراور و آینه | 7,900,000 | پونک | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 13 | سرویس خواب جوان/نوجوان | 21,000,000 | هفت حوض | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 14 | سرویس خواب دونفره تمام چوب مدل سه گل ثمر | 105,000,000 | یافت آباد جنوبی | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 15 | تخت تک نفره همراه تشک royal | 11,000,000 | نیروی هوایی (پیروزی) | 4 | — | 4 | no-match | 4 | no-match |
| 16 | سرویس خواب دونفره ارتمیس تمام mdf | 39,000,000 | شهرک ولیعصر جنوبی | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 17 | سرویس خواب و میز ارایش و ۲ پاتختی | 15,000,000 | اختیاریه | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 18 | سرویس تخت خواب | 8,500,000 | پونک | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 19 | تخت دونفره با تشک  جک دار | 21,000,000 | تهرانپارس غربی | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 20 | سرویس خواب فرانسوی کوئین  ابزاری | 66,000,000 | شهید رجایی | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 19 | 14 | 5 | 0 | 2 | 0 | 63.2% (12/19) | 100.0% (19/19) | 0 | 20.9% (19/91) |
| B | 19 | 14 | 5 | 0 | 2 | 0 | 63.2% (12/19) | 100.0% (19/19) | 0 | 20.9% (19/91) |
نمره ۳ پنهان‌شده: A: 2، B: 2. نشت بدون طعمه قبول‌شده: A: 2، B: 2.

ماتریس شکار 8 — حالت A (سطر = نمره مالک):

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 3، 0
- نمره 3: 0، 0، 9، 2
- نمره 4: 0، 0، 2، 3
ماتریس شکار 8 — حالت B:

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 3، 0
- نمره 3: 0، 0، 9، 2
- نمره 4: 0، 0، 2، 3

## شکار 9: عینک آفتابی ری‌بن اصل حتماً نه دست دوم نه فیک ترجیحاً تهران

پاسخ رفع ابهام:  condition=new. پرسمان جذب عنوان: «عینک آفتابی ری‌بن».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | عینک آفتابی Ray ban نو | 2,250,000 | مشهد | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 2 | عینک آفتابی ریبن RayBan | 38,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 3 | عینک دودی ری بن اورجینال RAY-BAN --- | 52,500,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 4 | عینک آفتابی ری بن اصل | 20,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 5 | عینک آفتابی ریبن ویفرraybanویفرر دودی ری بن مسافری | 100,000 | تهران | 3 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 6 | عینک آفتابی ری بن | 900,000 | قوچان | 3 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 7 | عینک آفتابی اورجینال Ray ban wayfarer | 28,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |
| 8 | عینک آفتابی ریبن RayBan3026usaمعاوضه و فروش | 6,900,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 9 | عینک آفتابی شیشه سنگی ری بن | 2,598,000 | تبریز | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 10 | عینک آفتابی Rayban meta Gen 2 | 139,000,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 11 | عینک آفتابی اصل Ray-Ban مدل W3100  با قاب و دستمال | 15,000,000 | تهران | 1 | — | 3 | cap، accessory:listing-adds:"قاب" | 3 | detail-unknown |
| 12 | عینک آفتابی RayBan ری بن | 12,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 13 | دوعدد عینک آفتابی RANDOLPH   و RAYBAN  اصل | 8,000,000 | تهران | 2 | — | 1 |  | 3 | detail-unknown |
| 14 | عینک آفتابی rayban wayfarer | 43,800,000 | تبریز | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 15 | عینک آفتابی ری بن Ray ban یشمی سبز | 1,950,000 | گرگان | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 16 | عینک دودی ری بن هوشمند سری اول | 65,000,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 17 | عینک آفتابی ری‌بن خلبانی | 4,500,000 | مشهد | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 18 | عینک آفتابی Ray-Ban Aviator | 28,900,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 19 | عینک آفتابی ری بن ( Ray-Ban ) مدل RB3447 طرح گرد | 1,600,000 | شیراز | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 20 | عینک آفتابی اورجینال ریبن Ray-Ban Wayfarer | 46,000,000 | تهران | 1 | — | 1 |  | 3 | detail-unknown |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 20 | 0 | 0 | 1 | 0 | 55.0% (11/20) | 95.0% (19/20) | 4 | 10.0% (19/190) |
| B | 20 | 20 | 0 | 0 | 1 | 0 | 35.0% (7/20) | 75.0% (15/20) | 4 | 9.5% (18/190) |
نمره ۳ پنهان‌شده: A: 0، B: 0. نشت بدون طعمه قبول‌شده: A: 1، B: 1.

ماتریس شکار 9 — حالت A (سطر = نمره مالک):

- نمره 1: 4، 0، 1، 0
- نمره 2: 1، 0، 6، 0
- نمره 3: 0، 0، 7، 0
- نمره 4: 0، 0، 1، 0
ماتریس شکار 9 — حالت B:

- نمره 1: 0، 0، 5، 0
- نمره 2: 0، 0، 7، 0
- نمره 3: 0، 0، 7، 0
- نمره 4: 0، 0، 1، 0

## شکار 10: تلسکوپ نجومی حتماً پایه دار نه چینی ترجیحاً زیر ۸ میل

پاسخ رفع ابهام:  condition=any. پرسمان جذب عنوان: «تلسکوپ».

| ردیف | عنوان | قیمت (تومان) | شهر | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|---|
| 1 | تلسکوپ اسکای واچر | 40,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 2 | تلسکوپ بچه گانه | 1,600,000 | لنجان | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 3 | تلسکوپ | 650,000 | تهران | 3 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 4 | تلسکوپ گالیله ای کامار | 4,500,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 5 | تلسکوپ کامار | 20,000,000 | کرج | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 6 | تلسکوپ معاوضه با دوچرخه تروتمیز | 14,000,000 | اردبیل | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 7 | تلسکوپ ۱۱۴ medic همراه لنز | 29,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 8 | تلسکوپ دابسونی | 150,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 9 | تلسکوپ eq130 | 77,000,000 | چهارباغ | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 10 | تلسکوپ | 13,000,000 | ارومیه | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 11 | تلسکوپ زیتازی مدلF70060 NeW | 16,600,000 | مشهد | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 12 | تلسکوپ ۷۰۰۷۶f | 1,000,000 | تهران | 3 | — | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |
| 13 | تلسکوپ سلسترون ۶۰ میلیمتری | 18,000,000 | تهران | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 14 | تلسکوپ برای دیدن ماه و سیارات | 7,500,000 | رشت | 2 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 15 | تلسکوپ ستاره شناسی برند بوسما | 55,000,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 16 | تلسکوپ فاندل | 2,800,000 | قم | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 17 | تلسکوپ عتیقه سریالدار  Dollond London 1920 | 15,000,000 | سقز | 4 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 18 | تلسکوپ زیتازی 70076 | 23,300,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 19 | تلسکوپ بازتابی 70076 | 12,000,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 20 | تلسکوپ زیتازی m30070 | 7,500,000 | تهران | 3 | — | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |

| حالت | شمرده‌شده | نمایش | ردیف ۴ | hidden | نشت | گم‌شده | توافق دقیق | توافق ±۱ | نمره ۱ در ۵ اول | جفت وارونه |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 20 | 20 | 0 | 0 | 2 | 0 | 55.0% (11/20) | 100.0% (20/20) | 0 | 31.1% (59/190) |
| B | 20 | 20 | 0 | 0 | 2 | 0 | 55.0% (11/20) | 100.0% (20/20) | 0 | 31.1% (59/190) |
نمره ۳ پنهان‌شده: A: 0، B: 0. نشت بدون طعمه قبول‌شده: A: 2، B: 2.

ماتریس شکار 10 — حالت A (سطر = نمره مالک):

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 7، 0
- نمره 3: 0، 0، 11، 0
- نمره 4: 0، 0، 2، 0
ماتریس شکار 10 — حالت B:

- نمره 1: 0، 0، 0، 0
- نمره 2: 0، 0، 7، 0
- نمره 3: 0، 0، 11، 0
- نمره 4: 0، 0، 2، 0

## فهرست کامل نشت‌ها (نمره مالک ۴ ولی نمایش‌داده‌شده)

| شکار | ردیف | عنوان | حالت | ردیف موتور | دلیل موتور |
|---|---|---|---|---|---|
| 1 | 3 | طرح وسپا دایچی jp150 هوندا ۱۲۵ هوندا ۲۰۰ | A | 3 | partial-evidence |
| 1 | 3 | طرح وسپا دایچی jp150 هوندا ۱۲۵ هوندا ۲۰۰ | B | 3 | detail-unknown، partial-evidence |
| 3 | 6 | Minecraft Nintendo switch نینتندو سویچ | A | 3 | price:implausible |
| 3 | 6 | Minecraft Nintendo switch نینتندو سویچ | B | 3 | detail-unknown، price:implausible |
| 4 | 4 | ۱۴ پرو مکس قابل معاوضه با ۱۵ پرو مکس | A | 3 | partial-evidence، price:out-of-range |
| 4 | 4 | ۱۴ پرو مکس قابل معاوضه با ۱۵ پرو مکس | B | 3 | detail-unknown، partial-evidence، price:out-of-range |
| 4 | 12 | آیفون ۱۵پرو مکس | A | 3 | partial-evidence، price:implausible |
| 4 | 12 | آیفون ۱۵پرو مکس | B | 3 | detail-unknown، partial-evidence، price:implausible |
| 4 | 20 | آیفون ۱۵پرو | A | 3 | partial-evidence، price:implausible |
| 4 | 20 | آیفون ۱۵پرو | B | 3 | detail-unknown، partial-evidence، price:implausible |
| 5 | 6 | آپارتمان همکف بدون مزاحمت | A | 3 | partial-evidence |
| 5 | 6 | آپارتمان همکف بدون مزاحمت | B | 3 | detail-unknown، partial-evidence |
| 8 | 8 | سرویس خواب نوزاد تا نوجوان برند mother baby | A | 3 | partial-evidence |
| 8 | 8 | سرویس خواب نوزاد تا نوجوان برند mother baby | B | 3 | detail-unknown، partial-evidence |
| 8 | 13 | سرویس خواب جوان/نوجوان | A | 3 | partial-evidence |
| 8 | 13 | سرویس خواب جوان/نوجوان | B | 3 | detail-unknown، partial-evidence |
| 9 | 19 | عینک آفتابی ری بن ( Ray-Ban ) مدل RB3447 طرح گرد | A | 3 | partial-evidence |
| 9 | 19 | عینک آفتابی ری بن ( Ray-Ban ) مدل RB3447 طرح گرد | B | 3 | detail-unknown، partial-evidence |
| 10 | 2 | تلسکوپ بچه گانه | A | 3 | partial-evidence |
| 10 | 2 | تلسکوپ بچه گانه | B | 3 | detail-unknown، partial-evidence |
| 10 | 17 | تلسکوپ عتیقه سریالدار  Dollond London 1920 | A | 3 | partial-evidence |
| 10 | 17 | تلسکوپ عتیقه سریالدار  Dollond London 1920 | B | 3 | detail-unknown، partial-evidence |

## فهرست کامل گم‌شده‌ها (نمره مالک ۱ یا ۲ ولی ردیف ۴ یا hidden)

| شکار | ردیف | عنوان | نمره مالک | حالت | وضعیت موتور | دلیل موتور |
|---|---|---|---|---|---|---|
| 1 | 4 | فروش cbr600زیر قیمت ایران | 2 | A | 4 | no-match |
| 1 | 4 | فروش cbr600زیر قیمت ایران | 2 | B | 4 | no-match |

## ردیف‌های ویژه (در عددهای کل نیامده‌اند)

| شکار | ردیف | عنوان | نمره مالک | ویژه | ردیف A | دلیل A | ردیف B | دلیل B |
|---|---|---|---|---|---|---|---|---|
| 3 | 17 | هر سه باهم نینتندو اولد،لیمیتد مانستر هانتر،دو | 2 | borderline | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 6 | 1 | ام وی ام 110 اتوماتیک چهارسیلندر، مدل 90 | 4 | city-filter | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 6 | 3 | لونا تمام برق پیمایش۴۲۰km و۵۰۰هزار گارانتی۱۶۵سرعت | 3 | borderline | 4 | no-match | 4 | no-match |
| 6 | 4 | میتسوبیشی asx2012 | 4 | city-filter | 4 | no-match | 4 | no-match |
| 6 | 5 | جک s3 اتوماتیک مدل ۹۷ | 4 | city-filter | 3 | partial-evidence | 3 | detail-unknown، partial-evidence |
| 8 | 2 | تخت دونفره | 3 | borderline | 3 | partial-evidence، price:implausible | 3 | detail-unknown، partial-evidence، price:implausible |

## فهم جمله — خروجی قرارداد (بدون قبول یا رد)

برای ۱۰ جمله طلایی، قرارداد با همان پاسخ رفع ابهام سنجش ساخته شده است. برای ۶ مثال CoachHint، بدون پاسخ رفع ابهام (خام).

| جمله | include | exclude | should | absentAttributes | قیمت کف | قیمت سقف | نرم/سخت قیمت | شهر | شهر سخت/ترجیح | transaction | condition | دسته |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| موتورسیکلت هوندا | موتورسیکلت، هوندا |  |  |  | — | — | — | all | — (بدون فیلتر شهر) | — | any | vehicles |
| دنا پلاس | دنا، پلاس |  |  |  | — | — | — | all | — (بدون فیلتر شهر) | — | any | vehicles |
| نینتندو سوییچ | نینتندو، سوییچ |  |  |  | — | — | — | all | — (بدون فیلتر شهر) | — | any | all |
| آیفون 15 پرو یا پرومکس ۲۵۶ میخوام تا ۹۰ میل | آیفون، 15، ۲۵۶، یکی‌از: پرو یا پرومکس |  |  |  | — | 90000000 | سخت | all | — (بدون فیلتر شهر) | — | any | mobile |
| آپارتمان دوخوابه مشهد تا ۳ میلیارد | آپارتمان، دوخوابه |  |  |  | — | 3000000000 | سخت | mashhad | سخت (text) | buy | — | real-estate |
| یه ماشین اتومات خانوادگی اصفهان میخوام | ماشین، اتومات، خانوادگی |  |  |  | — | — | — | isfahan | سخت (text) | — | any | vehicles |
| ویلا شیراز حیاط دار | ویلا |  | حیاط‌دار |  | — | — | — | shiraz | سخت (text) | buy | — | real-estate |
| تخت خواب دونفره چوبی میخوام در تهران باشه حتما سالم نه رنگ پریده ترجیحا زیر ده میل | تخت خواب، دونفره، چوبی، سالم | رنگ پریده |  |  | — | — | — | tehran | سخت (text) | — | any | home |
| عینک آفتابی ری‌بن اصل حتماً نه دست دوم نه فیک ترجیحاً تهران | عینک، آفتابی، ری‌بن، اصل | دست دوم، فیک |  |  | — | — | — | tehran | ترجیحی (preference) | — | new | personal |
| تلسکوپ نجومی حتماً پایه دار نه چینی ترجیحاً زیر ۸ میل | تلسکوپ، نجومی، پایه‌دار | چینی |  |  | — | — | — | all | — (بدون فیلتر شهر) | — | any | music |
| آپارتمان ۸۰ تا ۱۰۰ متری در سعادت‌آباد، آسانسور حتماً، طبقه اول نباشه، تا ۸ میلیارد | آپارتمان، سعادت‌آباد، آسانسور | طبقه اول | ۸۰ تا ۱۰۰ متری |  | — | 8000000000 | سخت | all | — (بدون فیلتر شهر) | — | — | real-estate |
| لپ‌تاپ گیمینگ، RTX 4060 حتماً، رم ۱۶ گیگ، تا ۸۰ میلیون | لپ‌تاپ، گیمینگ، RTX، 4060، رم، ۱۶ |  | گیگ |  | — | 80000000 | سخت | all | — (بدون فیلتر شهر) | — | — | mobile |
| آیفون ۱۳، بدون تعمیر، ۱۲۸ گیگ، تا ۵۰ میلیون | آیفون، ۱۳، ۱۲۸ |  | گیگ | تعمیر | — | 50000000 | سخت | all | — (بدون فیلتر شهر) | — | — | mobile |
| آپارتمان ۲ خوابه، آسانسور حتماً، ترجیحاً پارکینگ | آپارتمان، ۲، خوابه، آسانسور |  | پارکینگ |  | — | — | — | all | — (بدون فیلتر شهر) | — | — | real-estate |
| پژو ۲۰۷، مدل ۱۴۰۱ به بالا، تهران، تا ۱ میلیارد | پژو، ۲۰۷ |  |  |  | — | 1000000000 | سخت | tehran | سخت (text) | — | — | vehicles |
| یه لپ‌تاپ سبک برای دانشگاه، ۱۴ اینچ، رم حداقل ۱۶، تا ۴۰ میلیون | لپ‌تاپ، سبک، رم، ۱۴ |  | دانشگاه، اینچ |  | — | 40000000 | سخت | all | — (بدون فیلتر شهر) | — | — | mobile |
