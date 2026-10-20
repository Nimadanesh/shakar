#!/usr/bin/env python3
"""Experiment A blind grading packet (Decision v2 sec.8.6).

One shuffled pool per hunt: union of the three arms' top-10s (minus
historically graded pairs) + the sec.5.2 symmetric-difference sample,
indistinguishably mixed. Grades export ID-KEYED (the step-2 harness
law) as expa-grades.json: {"hunts": {"<n>": {"<adId>": grade}}}.
"""
import json, html, os

POOL = "/home/hatch/workspace/experiment-a/grading-pool.json"
POOLS = "/home/hatch/workspace/snapshot-v1/pools-full.json"
CONTRACTS = "/home/hatch/workspace/your_files/intended-contracts-v1.json"
OUT = "/home/hatch/workspace/your_files/experiment-a-grading-packet.html"
KEY = "expa-grades-v1"

pool = json.load(open(POOL))
pools = json.load(open(POOLS, encoding="utf-8-sig"))
queries = {str(c["n"]): c["query"] for c in json.load(open(CONTRACTS))["hunts"]}
thumbs = {}
for h, ads in pools.items():
    for a in ads:
        thumbs[a["sourceAdId"]] = a.get("thumbnail") or ""

FA = "۰۱۲۳۴۵۶۷۸۹"
def fa_num(x):
    return "".join(FA[int(c)] if c.isdigit() else c for c in f"{x:,}").replace(",", "٬")

def price_text(p):
    if not p:
        return "قیمت نامشخص"
    return fa_num(int(p)) + " تومان"

cards = []
total = 0
for h in range(1, 25):
    items = pool[str(h)]
    total += len(items)
    cards.append(f'<h2>شکار {fa_num(h)}: {html.escape(queries[str(h)])} '
                 f'<span class="cnt" id="cnt-{h}"></span></h2><div class="grid">')
    for i, it in enumerate(items):
        thumb = thumbs.get(it["adId"], "")
        img = f'<img src="{html.escape(thumb)}" loading="lazy">' if thumb else ""
        cards.append(f"""
<div class="card" id="card-{h}-{i}">
  {img}
  <div class="t">{html.escape(it['title'])}</div>
  <div class="d">{html.escape(it['desc'][:300])}</div>
  <div class="m">{price_text(it.get('price'))} · {html.escape(it.get('city',''))}</div>
  <div class="btns" data-h="{h}" data-ad="{html.escape(it['adId'])}">
    <button data-g="3">۳ عالی</button><button data-g="2">۲ خوب</button>
    <button data-g="1">۱ مرزی</button><button data-g="0">۰ بی‌ربط</button>
  </div>
</div>""")
    cards.append("</div>")

doc = f"""<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>نمره‌دهی کور — آزمایش A</title>
<style>
body{{font-family:Vazirmatn,Tahoma,sans-serif;background:#111;color:#eee;margin:0;padding:16px}}
h2{{border-bottom:1px solid #333;padding-bottom:6px;margin-top:28px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
.card{{background:#1b1b1b;border:1px solid #2c2c2c;border-radius:10px;padding:10px}}
.card.done{{border-color:#2e7d32}}
.card img{{width:100%;height:150px;object-fit:cover;border-radius:6px}}
.t{{font-weight:700;margin:6px 0}}
.d{{color:#bbb;font-size:13px;line-height:1.7}}
.m{{color:#8ab4f8;font-size:13px;margin:6px 0}}
.btns button{{margin:2px;padding:7px 10px;border-radius:7px;border:1px solid #444;background:#222;color:#eee;cursor:pointer}}
.btns button.sel{{background:#2e7d32;border-color:#2e7d32;color:#fff}}
#bar{{position:sticky;top:0;background:#111;padding:10px 0;z-index:5;border-bottom:1px solid #333}}
#exp{{background:#1565c0;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-size:15px}}
.cnt{{color:#8ab4f8;font-size:14px}}
</style></head><body>
<div id="bar"><b>نمره‌دهی کور — آزمایش A</b> · فقط خود آگهی را نمره بده:
۳ عالی برای این شکار، ۲ خوب، ۱ مرزی، ۰ بی‌ربط.
<span id="prog"></span>
<button id="exp">دانلود نمره‌ها (JSON)</button></div>
{''.join(cards)}
<script>
const KEY = "{KEY}";
let grades = {{}};
try {{ grades = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch(e) {{}}
function save() {{ try {{ localStorage.setItem(KEY, JSON.stringify(grades)); }} catch(e) {{}} }}
function paint() {{
  let done = 0, tot = 0;
  document.querySelectorAll('.btns').forEach(b => {{
    tot++;
    const h = b.dataset.h, ad = b.dataset.ad;
    const g = (grades[h] || {{}})[ad];
    b.querySelectorAll('button').forEach(x =>
      x.classList.toggle('sel', g !== undefined && +x.dataset.g === g));
    b.closest('.card').classList.toggle('done', g !== undefined);
    if (g !== undefined) done++;
  }});
  document.getElementById('prog').textContent = 'نمره داده‌شده: ' + done + ' از ' + tot + ' · ';
  for (let h = 1; h <= 24; h++) {{
    const el = document.getElementById('cnt-' + h);
    if (!el) continue;
    const bs = document.querySelectorAll('.btns[data-h="' + h + '"]');
    let d = 0; bs.forEach(b => {{ if ((grades[h] || {{}})[b.dataset.ad] !== undefined) d++; }});
    el.textContent = '(' + d + '/' + bs.length + ')';
  }}
}}
document.querySelectorAll('.btns button').forEach(btn =>
  btn.addEventListener('click', () => {{
    const b = btn.closest('.btns');
    if (!grades[b.dataset.h]) grades[b.dataset.h] = {{}};
    grades[b.dataset.h][b.dataset.ad] = +btn.dataset.g;
    save(); paint();
  }}));
document.getElementById('exp').addEventListener('click', () => {{
  const blob = new Blob([JSON.stringify({{hunts: grades}}, null, 1)], {{type: 'application/json'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'expa-grades.json'; a.click();
}});
paint();
</script></body></html>"""
open(OUT, "w", encoding="utf-8").write(doc)
print(f"packet: {total} ads -> {OUT} ({os.path.getsize(OUT)//1024} KB)")
