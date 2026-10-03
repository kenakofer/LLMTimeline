import csv, json, re, os, datetime, collections
from manifest import M
from lifecycle import LIFE, NOTES, TAGS, EDGES, EPOCH_EDGES, E
from pathlib import Path
HERE = Path(__file__).resolve().parent
CACHE = HERE / 'cache'

OUT = str(HERE.parents[1] / 'data')
A = {x['Model']: x for x in csv.DictReader(open(CACHE / 'all_ai_models.csv', encoding='utf-8'))}
ECI = {x['Model']: x for x in csv.DictReader(open(CACHE / 'eci_scores.csv', encoding='utf-8'))}
VER = json.load(open(HERE / 'verify_epoch.json'))
AV = json.load(open(HERE / 'avail.json'))
HFJ = json.load(open(HERE / 'hf.json'))
LINKS = lambda f: [u.rstrip('.,;') for u in re.findall(r'https?://[^\s,;]+', f or '')]
EPOCH_DB = 'https://epoch.ai/data/ai-models'
ORDER = ['training_cutoff', 'internal', 'limited', 'announced', 'available', 'deprecated', 'retired']
SUPPRESS_AVAIL = {'gemini-1-5-pro', 'gemini-1-0-ultra'}

def params(r):
    try: p = float(r['Parameters'])
    except (TypeError, ValueError): return None
    for div, suf in ((1e12, 'T'), (1e9, 'B'), (1e6, 'M')):
        if p >= div:
            v = p / div
            return f"{v:.0f}{suf}" if v >= 10 or v == int(v) else f"{v:.1f}{suf}".replace('.0' + suf, suf)
    return None

def generated_events(node, r):
    evs = []
    date = r['Publication date']
    key = f"{r['Link'].strip()}|{date}"
    st = VER.get(key, 'NOTFOUND')
    links = LINKS(r['Link'])
    if st.startswith('FOUND'):
        src = st.split()[1]
        ann = E('announced', date, source=src)
    else:
        src = links[0] if links else EPOCH_DB
        basis = "Date from Epoch AI's model database; not found verbatim on the linked page."
        prec = 'day'
        if date.endswith('-01'):
            d = datetime.date.fromisoformat(date)
            date = d.replace(day=15).isoformat(); prec = 'month'
            basis += ' Epoch gives the first of the month, read here as month precision.'
        ann = E('announced', date, precision=prec, confidence='likely', source=src, basis=basis)
    evs.append(ann)
    acc = r['Model accessibility']
    if acc.startswith('Limited'):
        evs.append(dict(ann, type='limited', basis=(ann.get('basis', '') + f' Epoch AI classifies access as "{acc}".').strip()))
    elif acc.startswith(('API', 'Open weights', 'Hosted')) and node['id'] not in SUPPRESS_AVAIL:
        phrase = AV.get(key)
        if st.startswith('FOUND') and phrase and not phrase.startswith('NEG'):
            m = re.search(r'(available today|now available|available now|starting today|rolling out today|weights are available|released today|we are releasing the weights|open[- ]sourc\w+ (the )?(model )?weights|is available \w+ [\w ]{0,20})', phrase, re.I)
            evs.append(E('available', ann['date'], source=ann['source'],
                         basis=f'The announcement states availability: "…{m.group(0) if m else "available"}…".'))
        else:
            evs.append(E('available', ann['date'], precision=ann['precision'], confidence='estimated', source=ann['source'],
                         basis=f'Epoch AI classifies access as "{acc}"; availability from the announcement date is inferred, not documented.'))
    return evs

def node_events(node):
    r = A.get(node['epoch']) if node['epoch'] else None
    evs = generated_events(node, r) if r else []
    over = LIFE.get(node['id'], [])
    types = {e['type'] for e in over}
    evs = [e for e in evs if e['type'] not in types] + over
    return sorted(evs, key=lambda e: (e['date'], ORDER.index(e['type'])))

# ── YAML emitters ───────────────────────────────────────────────────────────
def q(s):
    s = str(s)
    if re.match(r'^[A-Za-z0-9][\w .,()/+\-]*$', s) and not re.match(r'^(true|false|null|~|\d[\d.]*)$', s) and ': ' not in s:
        return s
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

def fold(key, text, ind):
    pad = ' ' * ind
    words, lines, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 > 88 - ind - 2 and cur:
            lines.append(cur); cur = w
        else:
            cur = f'{cur} {w}'.strip()
    if cur: lines.append(cur)
    return f'{pad}{key}: >\n' + ''.join(f'{pad}  {l}\n' for l in lines)

def emit_event(e):
    out = f"      - type: {e['type']}\n        date: {e['date']}\n        precision: {e['precision']}\n        confidence: {e['confidence']}\n"
    if e.get('basis'): out += fold('basis', e['basis'], 8)
    if e.get('bounds'):
        out += '        bounds:\n' + ''.join(f'          {k}: {v}\n' for k, v in e['bounds'].items())
    if e.get('source'): out += f"        source: {e['source']}\n"
    return out

def node_meta(node):
    r = A.get(node['epoch']) if node['epoch'] else None
    meta = {}
    if node.get('org'): meta['org'] = node['org']
    if node.get('family'): meta['family'] = node['family']
    meta['product_line'] = node['product_line']
    if r:
        p = params(r)
        if p: meta['params'] = p
        meta['open_weights'] = r['Model accessibility'].startswith('Open weights')
    elif node['id'] in ('deepseek-v3-2',):
        meta['open_weights'] = True
    else:
        meta['open_weights'] = False
    h = HFJ.get(node['id'])
    if h and h.get('repo'):
        meta['open_weights'] = True
        lic = h.get('licence')
        if lic and lic not in ('other', 'unknown'): meta['licence'] = lic
        meta['hf_id'] = h['repo']
    if node['epoch']: meta['epoch_id'] = node['epoch']
    return meta

def emit_model(node):
    out = f"  - id: {node['id']}\n    name: {q(node['name'])}\n"
    for k, v in node_meta(node).items():
        out += f"    {k}: {str(v).lower() if isinstance(v, bool) else q(v)}\n"
    tags = list(TAGS.get(node['id'], []))
    r = A.get(node['epoch']) if node['epoch'] else None
    if r and r.get('Frontier model') == 'True': tags.append('frontier')
    if tags: out += f"    tags: [{', '.join(tags)}]\n"
    if node['id'] in NOTES: out += fold('notes', NOTES[node['id']], 4)
    evs = node_events(node)
    out += '    events:\n' + ''.join(emit_event(e) for e in evs)
    return out

HEADERS = {
  'openai': 'OpenAI', 'anthropic': 'Anthropic', 'google': 'Google DeepMind (including legacy Google Brain, Google Research and DeepMind models)',
  'meta': 'Meta', 'deepseek': 'DeepSeek', 'mistral': 'Mistral', 'xai': 'xAI', 'alibaba': 'Alibaba (Qwen)', 'moonshot': 'Moonshot AI (Kimi)',
  'zhipu': 'Zhipu AI / Z.ai (GLM)', 'minimax': 'MiniMax', 'other': 'Other organisations — `org` names the real developer',
}
COMMON = """#
# Generated by the October 2026 backfill from Epoch AI's model database, then checked
# against first-party pages. Confidence reflects that check: `confirmed` means the date
# was found on a first-party page; `likely` means it comes from Epoch AI and was not
# found verbatim; `estimated` availability is inferred from Epoch's access classification.
# Open-weight models get no `retired` event: API shutdowns go in `notes`, because the
# weights remain available.
"""
by_lab = collections.defaultdict(list)
for n in M: by_lab[n['lab']].append(n)
for lab, nodes in by_lab.items():
    body = f"# {HEADERS[lab]}\n{COMMON}\nlab: {lab}\n\nmodels:\n" + '\n'.join(emit_model(n) for n in nodes)
    open(f'{OUT}/models/{lab}.yaml', 'w').write(body)

# ── lineage ──
ids = {n['id'] for n in M}
def edge(f, t, typ, conf, src, basis):
    assert f in ids and t in ids, (f, t)
    return f"  - from: {f}\n    to: {t}\n    type: {typ}\n    confidence: {conf}\n" + fold('basis', basis, 4) + f"    source: {src}\n"
ep_by = {n['id']: n for n in M}
out = """# Lineage edges: where a model came from. See data/SCHEMA.md § Lineage.
#
# Every edge cites a source, including rumors. Edges point parent -> child.

edges:
"""
out += '\n'.join(edge(*e) for e in EDGES)
out += "\n  # Recorded by Epoch AI's base-model field; not yet re-verified first-hand.\n\n"
for f, t, base in EPOCH_EDGES:
    r = A[ep_by[t]['epoch']]
    src = (LINKS(r['Link']) or [EPOCH_DB])[0]
    out += edge(f, t, 'finetune', 'likely', src,
                f'Epoch AI records "{base}" as the base model of {r["Model"]}. Not yet checked against the linked source.') + '\n'
open(f'{OUT}/lineage.yaml', 'w').write(out.rstrip() + '\n')

# ── scores ──
out = """# Epoch Capabilities Index (ECI) scores — the capability axis.
#
# Imported from Epoch AI, not curated by hand. Kept apart from data/models/ so a
# re-import never touches lifecycle facts. See data/SCHEMA.md § Scores.
# Where Epoch scores several snapshots of one model, the launch snapshot is used.

source: https://epoch.ai/benchmarks/eci
retrieved: 2026-10-01
scores:
"""
for n in M:
    if not n['eci']: continue
    r = ECI[n['eci']]
    out += f"  - model: {n['id']}\n    eci: {float(r['eci'])}\n"
    if r['eci_ci_low'] and r['eci_ci_high']:
        out += f"    ci_low: {float(r['eci_ci_low'])}\n    ci_high: {float(r['eci_ci_high'])}\n"
    if n['eci'] != n['name']: out += f"    note: {q('Epoch entry: ' + n['eci'])}\n"
open(f'{OUT}/scores/eci.yaml', 'w').write(out)
print('wrote', len(M), 'models,', len(EDGES) + len(EPOCH_EDGES), 'edges,', sum(1 for n in M if n['eci']), 'scores')
