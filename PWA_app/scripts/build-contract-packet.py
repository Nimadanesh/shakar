#!/usr/bin/env python3
"""Contract-confirmation grading packet (Decision v2 step 6 follow-up:
human verdict on the wired contract + current engine as a whole).

Source: navid's laptop run 2026-10-21 (battery-contract-out/20261021-1124,
engine 4e73b52, 24/24 done, Mizan shadow active, mizanRejected=0). Two sections per hunt: top-10 (ID-keyed export) and the
rejected sample (title-keyed — the payload carries no ad id; exported
in packet order WITH titles so the join is self-describing).
Grades rule (standing): results graded on the ad itself; in the
rejected section 2-3 means the engine wrongly killed a good ad.
Export: r12-grades.json.
"""
import json, html, os, re, glob

DONE_DIR = "/home/hatch/workspace/battery-contract-in/battery-contract-out/20261021-1124"
CONTRACTS = "/home/hatch/workspace/your_files/intended-contracts-v1.json"
OUT = "/home/hatch/workspace/your_files/contract-grading-packet.html"
KEY = "contract-grades-v1"

queries = {c["n"]: c["query"] for c in json.load(open(CONTRACTS))["hunts"]}

def load_done(fp):
    raw = open(fp, encoding="utf-8-sig").read()
    if raw.lstrip().startswith("data:"):
        for line in raw.splitlines():
            if line.startswith("data: "):
                try:
                    ev = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                if ev.get("type") == "done":
                    return ev
        return None
    return json.loads(raw)

FA = "۰۱۲۳۴۵۶۷۸۹"
def fa_num(x):
    return "".join(FA[int(c)] if c.isdigit() else c for c in f"{x:,}").replace(",", "٬")

def price_text(p):
    return fa_num(int(p)) + " تومان" if p else "قیمت نامشخص"

cards = []
tot_top = tot_rej = 0
for n in range(1, 25):
    d = load_done(os.path.join(DONE_DIR, f"done-{n}.json"))
    results = (d.get("results") or [])[:10]
    rejected = ((d.get("stats") or {}).get("rejectedSample") or [])
    tot_top += len(results)
    tot_rej += len(rejected)
    cards.append(f'<h2>شکار {fa_num(n)}: {html.escape(queries[n])} '
                 f'<span class="cnt" id="cnt-{n}"></span></h2>')
    cards.append('<div class="grid">')
    for r in results:
        thumb = r.get("thumbnail") or ""
        img = f'<img src="{html.escape(thumb)}" loading="lazy">' if thumb else ""
        cards.append(f"""
<div class="card">
  {img}
  <div class="t">{html.escape(r.get('title',''))}</div>
  <div class="d">{html.escape((r.get('descSnippet') or '')[:300])}</div>
  <div class="m">{price_text(r.get('price'))} · {html.escape(r.get('city',''))}</div>
  <div class="btns" data-h="{n}" data-sec="top10" data-ad="{html.escape(r['sourceAdId'])}">
    <button data-g="3">۳ عالی</button><button data-g="2">۲ خوب</button>
    <button data-g="1">۱ مرزی</button><button data-g="0">۰ بی‌ربط</button>
  </div>
</div>""")
    cards.append('</div>')
    if rejected:
        cards.append(f'<h3>نمونه‌ی ردشده‌های شکار {fa_num(n)} '
                     f'<span class="cnt" id="cntr-{n}"></span></h3><div class="grid">')
        for i, r in enumerate(rejected):
            cards.append(f"""
<div class="card rej">
  <div class="t">{html.escape(r.get('title',''))}</div>
  <div class="d">{html.escape((r.get('descSnippet') or '')[:300])}</div>
  <div class="m">{price_text(r.get('price'))} · دلیل موتور: {html.escape(r.get('kind',''))}</div>
  <div class="btns" data-h="{n}" data-sec="rejected" data-idx="{i}"
       data-title="{html.escape(r.get('title',''), quote=True)}">
    <button data-g="3">۳ عالی</button><button data-g="2">۲ خوب</button>
    <button data-g="1">۱ مرزی</button><button data-g="0">۰ بی‌ربط</button>
  </div>
</div>""")
        cards.append('</div>')

doc = f"""<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>نمره‌دهی قرارداد — باتری لپ‌تاپ، انجین 4e73b52</title>
<style>
body{{font-family:Vazirmatn,Tahoma,sans-serif;background:#111;color:#eee;margin:0;padding:16px}}
h2{{border-bottom:1px solid #333;padding-bottom:6px;margin-top:28px}}
h3{{color:#f0a35e;margin-top:20px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
.card{{background:#1b1b1b;border:1px solid #2c2c2c;border-radius:10px;padding:10px}}
.card.rej{{border-style:dashed}}
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
<div id="bar"><b>نمره‌دهی قرارداد</b> (باتری لپ‌تاپ — موتور فعلی با قرارداد) · فقط خود آگهی:
۳ عالی، ۲ خوب، ۱ مرزی، ۰ بی‌ربط. در بخش ردشده‌ها، ۲ یا ۳ یعنی موتور اشتباه کشته.
<span id="prog"></span>
<button id="exp">دانلود نمره‌ها (JSON)</button></div>
{''.join(cards)}
<script>
const KEY = "{KEY}";
let grades = {{}};
try {{ grades = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch(e) {{}}
function save() {{ try {{ localStorage.setItem(KEY, JSON.stringify(grades)); }} catch(e) {{}} }}
function keyOf(b) {{
  return b.dataset.sec === 'top10' ? 't:' + b.dataset.ad : 'r:' + b.dataset.idx;
}}
function paint() {{
  let done = 0, tot = 0;
  document.querySelectorAll('.btns').forEach(b => {{
    tot++;
    const h = b.dataset.h;
    const g = (grades[h] || {{}})[keyOf(b)];
    b.querySelectorAll('button').forEach(x =>
      x.classList.toggle('sel', g !== undefined && +x.dataset.g === g));
    b.closest('.card').classList.toggle('done', g !== undefined);
    if (g !== undefined) done++;
  }});
  document.getElementById('prog').textContent = 'نمره داده‌شده: ' + done + ' از ' + tot + ' · ';
}}
document.querySelectorAll('.btns button').forEach(btn =>
  btn.addEventListener('click', () => {{
    const b = btn.closest('.btns');
    if (!grades[b.dataset.h]) grades[b.dataset.h] = {{}};
    grades[b.dataset.h][keyOf(b)] = +btn.dataset.g;
    save(); paint();
  }}));
document.getElementById('exp').addEventListener('click', () => {{
  const out = {{ hunts: {{}} }};
  document.querySelectorAll('.btns').forEach(b => {{
    const h = b.dataset.h, g = (grades[h] || {{}})[keyOf(b)];
    if (g === undefined) return;
    if (!out.hunts[h]) out.hunts[h] = {{ top10: {{}}, rejected: [] }};
    if (b.dataset.sec === 'top10') out.hunts[h].top10[b.dataset.ad] = g;
    else out.hunts[h].rejected.push({{ title: b.dataset.title, grade: g }});
  }});
  const blob = new Blob([JSON.stringify(out, null, 1)], {{type: 'application/json'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'contract-grades.json'; a.click();
}});
paint();
</script></body></html>"""
open(OUT, "w", encoding="utf-8").write(doc)
print(f"Contract packet: top10 {tot_top} + rejected {tot_rej} = {tot_top + tot_rej} cards -> {OUT}")
