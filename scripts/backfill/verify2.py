import json, datetime, concurrent.futures as cf
import verify as V   # reuses fetch/patterns/links; importing reruns nothing heavy? guard below
from pathlib import Path
HERE = Path(__file__).resolve().parent
CACHE = HERE / 'cache'
res=json.load(open(HERE / 'verify_epoch.json'))
def retry(k):
    field,date=k.rsplit('|',1)
    d=datetime.date.fromisoformat(date)
    for url in V.links(field):
        for days in (14,60):
            ts=(d+datetime.timedelta(days=days)).strftime('%Y%m%d')
            try: t=V.fetch(f'https://web.archive.org/web/{ts}/{url}')
            except Exception: continue
            if any(p.search(t) for p in V.patterns(d)): return k,'FOUND '+url+' (archived)'
    return k,res[k]
todo=[k for k,v in res.items() if not v.startswith('FOUND')]
with cf.ThreadPoolExecutor(8) as ex:
    for k,v in ex.map(retry,todo): res[k]=v
json.dump(res,open(HERE / 'verify_epoch.json','w'),indent=1)
import collections; print(collections.Counter(v.split()[0] for v in res.values()))
