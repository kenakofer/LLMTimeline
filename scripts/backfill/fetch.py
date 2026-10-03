import sys, re, html, urllib.request
from pathlib import Path
HERE = Path(__file__).resolve().parent
CACHE = HERE / 'cache'
def text(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 LLMTimeline-curator'})
    raw=urllib.request.urlopen(req,timeout=40).read().decode('utf-8','replace')
    raw=re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>',' ',raw)
    raw=re.sub(r'(?i)<br\s*/?>|</(p|div|li|tr|h\d|table|section)>','\n',raw)
    raw=re.sub(r'(?i)</t[dh]>',' | ',raw)
    t=html.unescape(re.sub(r'<[^>]+>','',raw))
    return '\n'.join(l.strip() for l in t.splitlines() if l.strip())
for name,url in [a.split('=',1) for a in sys.argv[1:]]:
    try:
        t=text(url); open(CACHE / f'{name}.txt','w').write(url+'\n'+t); print(name,len(t))
    except Exception as e: print(name,'FAIL',e)
