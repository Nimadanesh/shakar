# Issue 16 — C01 contextual mention vs offered secondary item audit

Date: 2026-10-25
Branch: `experiment/issue16-specific-part-body-20261024`
Status: source-backed interpretation note; no rule or production behavior change.

## Question

Does Capture 06A C01 merely mention a catalytic converter as context, or does the listing actually offer one despite its title naming other parts?

## Frozen source and independent grade

- Query: `کاتالیزور خودرو`
- Capture 06A workflow: [run 40096410639](https://github.com/Nimadanesh/shakar/actions/runs/40096410639), artifact ID `12560808508`.
- Listing ID: `gaPT4jAd`.
- Exact title: `لنت برلیانس،سنسور اکسیژن بنز،پمپgdi،استارت سانتافه`.
- Frozen description snapshot: `یک دست لنت عقب برلیانس سری ۳ یک عدد سنسور اکسیژن بنز کلاس e اصلی یک عدد هدرز با کاتالیزور نو پالس ان اس ۲۰۰ ۲ حلقه لاستیک ۱۸۵،۶۵،۱۴ ،یک حلقه کویر یک حلقه گلدستون یک عدد پمپ gdi سونوتا هیبرید آرمیچر یا روتور استارت سانتافه ۲۰۱۵ تا ۲۰۱۸ فابریک تماس چت دیوار`.
- Locked human grade: **2** (relevant, but incomplete / not an exact direct match).
- In the original production diagnostic snapshot this listing was eligible as `near`; that production outcome is distinct from the experimental shadow-kind rejection discussed here.

## Source-level finding

This is not only a contextual mention. The description has an item-list structure and includes the explicit offered-item phrase `یک عدد هدرز با کاتالیزور نو پالس ان اس ۲۰۰` among multiple parts. The converter is attached to an offered header assembly for a named motorcycle model, while the title is led by other parts and the overall listing is a mixed inventory. The source therefore supports the human grade 2: genuine but secondary/incomplete target evidence, not an exact, direct catalyst-only offer.

This distinction matters: the evidence does **not** justify treating every body mention of `کاتالیزور` as an offer. It does show that a title-head-only rejection can miss a real secondary offer when a target item is explicitly enumerated in a multi-item body.

## Decision and next gate

- Preserve the locked human grade and frozen source snapshot.
- Do not change the production rule or broaden the part-kind lexicon based on C01.
- Do not count C01 as prospective data for the 12-item paired pilot; it is known discovery evidence.
- Use C01 only as a source-pinned **diagnostic counterexample** when checking the proposed shadow transition. The only candidate behavior worth testing remains `reject → unknown` for explicit body-level offers; never `reject → allow`.
- The paired pilot remains blocked until a complete, previously unseen packet satisfies the frozen protocol. Repeated quota-shortfall captures are not human-evaluation packets.

## Limits

This is one source-matched example, not a general estimate of body-only recall or of the shadow rule's safety. It does not establish that every multi-item mention is a valid offer, nor does it resolve other false-rejection and false-acceptance cases. The separate counter-risk—incorrectly rescuing a listing where the target is only incidental—still needs source-backed negative controls.

No production source, ranking, eligibility logic, `HEAD_KIND`, `main`, merge, or deployment was changed.
