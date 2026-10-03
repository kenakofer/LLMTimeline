import csv, json, re, sys, html, datetime, urllib.request, concurrent.futures as cf
from manifest import M
from pathlib import Path
HERE = Path(__file__).resolve().parent
CACHE = HERE / 'cache'
A={x['Model']:x for x in csv.DictReader(open(CACHE / 'all_ai_models.csv',encoding='utf-8'))}
MON=['January','February','March','April','May','June','July','August','September','October','November','December']
def patterns(d):
    y,mo,da=d.year,d.month,d.day; F=MON[mo-1]; S=F[:3]
    pats=[f'{y}-{mo:02d}-{da:02d}', f'{y}/{mo:02d}/{da:02d}', f'{y}年{mo}月{da}日',
          rf'\b{F}\s+{da},?\s+{y}', rf'\b{S}\.?\s+{da},?\s+{y}', rf'\b{da}\s+{F}\.?,?\s+{y}', rf'\b{da}\s+{S}\.?,?\s+{y}',
          rf'\b{F}\s+0?{da}(st|nd|rd|th)?,?\s+{y}', f'{y}{mo:02d}{da:02d}']
    return [re.compile(p, re.I) for p in pats]
import subprocess
def fetch(url):
    p=subprocess.run(['curl','-sSL','--max-time','30','-A','Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36','-H','Accept-Language: en',url],capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode()[:80])
    raw=p.stdout[:4_000_000]
    if raw[:4]==b'%PDF':
        q=subprocess.run(['pdftotext','-l','3','-','-'],input=raw,capture_output=True)
        return q.stdout.decode('utf-8','replace')
    return html.unescape(re.sub(r'<[^>]+>',' ',raw.decode('utf-8','replace')))
def links(field): return [u.rstrip('.,;') for u in re.findall(r'https?://[^\s,;]+', field)]
def check(item):
    field,date=item
    d=datetime.date.fromisoformat(date); best=('NOTFOUND',None)
    for url in links(field):
        try: t=fetch(url)
        except Exception as e:
            if best[0]=='NOTFOUND' and best[1] is None: best=('ERR '+str(e)[:50],url)
            continue
        if any(p.search(t) for p in patterns(d)): return field,date,'FOUND '+url
        if re.search(rf'\b{MON[d.month-1][:3]}\w*\.?\s+{d.year}\b', t): best=('MONTH',url)
        elif best[1] is None or best[0].startswith('ERR'): best=('NOTFOUND',url)
    return field,date,f'{best[0]} {best[1]}'
if __name__=='__main__':
  items=set()
  for x in M:
      r=A.get(x['epoch']) if x['epoch'] else None
      if r and 'http' in r['Link']: items.add((r['Link'].strip(), r['Publication date']))
  res={}
  with cf.ThreadPoolExecutor(16) as ex:
      for url,date,st in ex.map(check, sorted(items)): res[f'{url}|{date}']=st
  json.dump(res,open(HERE / 'verify_epoch.json','w'),indent=1)
  import collections; print(collections.Counter(v.split()[0] for v in res.values()))
