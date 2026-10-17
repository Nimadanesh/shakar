# Adversarial category cases — verification input

Read by `src/lib/adversarial-verify.scratch.test.ts`.
Each section is a markdown table: `| query | expected | why tricky |`.
The `why` column is informational only. `expected` is normalized
(English id, Persian name, or null/نامشخص all accepted).

## sanity

Six already-handled anchors from the delegation prompt (2026-10-16).
These must keep passing — a regression here is a P0.

| query | expected | why tricky |
|---|---|---|
| بادام زمینی | null | substring «زمین» inside «زمینی» must not fire real-estate |
| ماشین لباسشویی | home | «ماشین» alone hints vehicles; compound is a home appliance |
| یخچال سامسونگ | home | Samsung makes phones AND fridges — brand is cross-category |
| تعمیر یخچال | services | service demand, not a fridge hunt — must not ask «نو یا کارکرده؟» |
| دفتر مشق | null | «دفتر» hints office/real-estate; compound is stationery |
| تیپ مردانه | null | «تیپ» hints vehicle trim level; here it is clothing style |

## deepseek

| query | expected | why tricky |
|---|---|---|
| پیش‌فروش ساختمان | real-estate | «ساختمان/پیش‌فروش» absent from REAL_ESTATE_WORDS → null on an obviously property query |
| پنت هاوس | real-estate | list stores ZWNJ/no-ZWNJ single tokens; spaced «پنت هاوس» is two tokens → no match |
| رهن و اجاره | real-estate | «رهن/اجاره» are transaction words, not category words; noun-less rental → null |
| خانه کلنگی حیاط دار | real-estate | colloquial «کلنگی» + extra modifiers; head word must carry it |
| برج باغ لوکس | real-estate | «برج» is the only keyword; lux compound «برج باغ» stress-tests non-keyword gluing |
| ملک اداری | real-estate | «اداری/دفتر» tempt services; real-estate-first precedence must hold |
| خودرو تعمیری | vehicles | «تعمیری» must read as condition (Q4 guard before stemmer), not service demand |
| لندکروزر صفر | vehicles | colloquial model missing from VEHICLE_HINT_WORDS → null despite «صفر» car context |
| بنز کلاسیک ۱۹۹۲ | vehicles | bare «بنز» not in lexicon; brand-only fallback absent by design |
| کامیون یخچال دار | vehicles | «یخچال» is a vehicle disqualifier → refrigerated truck flips to home |
| پژو پارس کولر دار | vehicles | «کولر» disqualifier → car-with-AC flips to home |
| موتور خودرو | vehicles | «موتور» alone means motorcycle; + «خودرو» is a car part — must stay vehicles, not industrial |
| لپ تاپ گیمینگ | mobile | list stores ZWNJ «لپ‌تاپ»; the common spaced form never matches → null |
| پاور بانک انکر | mobile | keyword is single token «پاوربانک»; spaced form → null |
| هدست بلوتوثی | mobile | «هدست» synonym of هدفون/هندزفری missing → null |
| کیف لپ‌تاپ | mobile | «کیف» is personal; mobile precedence must win for a laptop bag |
| موس گیمینگ | mobile | computer peripheral absent from list → null |
| مونوپاد سلفی | mobile | phone accessory in colloquial form; no keyword → null |
| کولر گازی سامسونگ | home | «سامسونگ» hits mobile and «کولر» is NOT a mobile disqualifier → AC → mobile |
| شیر آب اهرمی | home | «شیر» (lion/milk/faucet/valve) deliberately absent → null on a common home good |
| کاغذ دیواری | home | decor good with no keyword (پرده/آینه exist, this doesn't) → null |
| چرخ گوشت | home | appliance whose words («چرخ») tempt vehicles; no keyword → null |
| ساعت دیواری دیجیتال | home | «ساعت» sends personal first — wall clock is home; taxonomy tension to confirm |
| ماشین اسپرسوساز | home | «ماشین» hits vehicles and the enumerated disqualifiers don't know espresso machines |
| اسباب بازی | music | keyword is ZWNJ «اسباب‌بازی»; the spaced form people type never matches → null |
| لگو کلاسیک | music | toy brand absent from LEISURE_HINT_WORDS → null |
| ویولون دست دوم | music | spelling variant «ویولون» vs «ویولن» kills whole-word match; «دست دوم» adds noise |
| سه تار | music | keyword «سه‌تار» is ZWNJ; spaced «سه تار» splits into two tokens → null |
| ماهیگیری با قلاب | music | leisure ≠ instruments only; hobby with no keyword → null |
| تلسکوپ نجومی | music | hobby gear outside the instrument list → null (category is سرگرمی و فراغت) |
| ماشین اصلاح فیلیپس | personal | «ماشین»+«اصلاح» disqualifier strips vehicles, but nothing matches razor → null |
| اتوی مو | personal | ezafe form «اتوی» ≠ keyword «اتو»; spaced «اتو مو» would land home — hair tool splits categories |
| شلوارک جین | personal | whole-word: «شلوارک» ≠ «شلوار» → null |
| عطر مردانه | personal | «مردانه» only disqualifies vehicles — must not poison a genuine «عطر» hit |
| ساعت مچی کاسیو | personal | «ساعت» → personal here; same head word as wall-clock trap, two verdicts |
| کوله‌پشتی | personal | ZWNJ compound ≠ personal keyword «کوله» → null for a bag |
| کارواش سیار | services | service noun absent from SERVICE_STANDALONE_WORDS → null |
| اسباب کشی منزل | services | spaced «اسباب کشی» misses the ZWNJ keyword; «منزل» isn't real-estate either → null |
| خشکشویی | services | next to قالیشویی in reality but not in the list → null |
| نظافت منزل | services | «نظافت» was deliberately rejected (industrial-cleaning good); home-clean demand now unrecognized → null |
| سرویس کولر گازی | services | «سرویس» is not a demand cue (only تعمیر/نصب/نصاب) → falls through to home |
| تعمیرات پکیج دیواری | services | services must beat home's «پکیج دیواری» phrase — precedence guard (positive) |
| استخدام راننده وانت | jobs | «وانت» hits vehicles, and goods categories run BEFORE jobs → vehicles steals a job ad |
| فرصت شغلی حسابدار | jobs | only استخدام/کاریابی are jobs words; «شغلی» synonym missing → null |
| کارآموز گرافیک | jobs | internship wording missing → null |
| کارمند اداری تمام وقت | jobs | role word without «استخدام» → null (role words were banned as goods terms — jobs gap) |
| دستیار دندانپزشک | jobs | position phrase; tempts services/medical framing → null either way |
| کاریابی آنلاین | jobs | positive: «کاریابی» must survive an extra modifier |
| ماشین آلات صنعتی | industrial | spaced twin of the ZWNJ test «ماشین‌آلات صنعتی»: «ماشین» hits vehicles first → vehicles |
| موتور برق دیزلی | industrial | «موتور» motorcycle cue fires vehicles; a generator is industrial |
| کمپرسور هوا | industrial | phrase-only industrial list has no entry → null |
| دیگ بخار کارخانه | industrial | «کارخانه» not a keyword; «دیگ» is not home either → null |
| دریل ستونی | industrial | power tool absent → null |
| خط بسته‌بندی مواد غذایی | industrial | «خط تولید» needs the exact adjacent phrase; «خط بسته‌بندی» is the same beast → null |
| سامسونگ | null | bare brand is in MOBILE_HINT_WORDS → engine guesses mobile; never-guess violated |
| برج میلاد | null | «برج» real-estate keyword matches a landmark → real-estate (peanut family) |
| خانه بازی کودکان | null | «خانه» matches an indoor-playground venue → real-estate wrongly |
| تیپ اسپرت زنانه | null | «تیپ» hint killed by «زنانه» disqualifier — must stay null like تیپ مردانه (guard stability) |
| شیر | null | canonical ambiguous noun (lion/milk/faucet/valve) — stays null until context appears |
| فروش ویژه | null | generic commerce phrase, zero category signal — «فروش» must stay transaction-only |
