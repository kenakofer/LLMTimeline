# October 2026 backfill

The one-off pipeline that rebuilt `data/` from Epoch AI's model database and re-verified every
pre-existing entry. Kept for provenance and as a starting point for the weekly update agent.

> **`gen.py` overwrites `data/models/*.yaml`, `data/lineage.yaml` and `data/scores/eci.yaml`
> from scratch.** Any hand edit made to those files since the backfill would be lost. Treat this
> as a record of how the dataset was built, not a tool to re-run, unless you first fold later
> edits back into `manifest.py` / `lifecycle.py`.

## Files

| File | Role |
|---|---|
| `manifest.py` | The curated node list: one row per model, with its lab, product line, and the Epoch AI and ECI names it joins on |
| `lifecycle.py` | Hand-entered lifecycle facts (deprecations, retirements, corrected dates), notes, tags and lineage edges, each with the first-party source it was read from |
| `gen.py` | Joins the manifest, Epoch data, verification results and lifecycle facts into the YAML files |
| `verify.py` | Fetches each Epoch "Link" and checks whether the publication date appears on the page (`verify_epoch.json`) |
| `verify2.py` | Retries unconfirmed dates against Internet Archive snapshots near the release date |
| `hf.py` | Looks up Hugging Face repos for open-weight models: `base_model`, licence (`hf.json`) |
| `fetch.py` | Saves lab deprecation and model pages as text, for reading lifecycle dates |
| `verify_epoch.json`, `avail.json`, `hf.json` | Results of the checks above, as of 2026-10-01 — the record of which dates were confirmed |

## Running

Inputs are downloaded into `cache/` (git-ignored):

```sh
cd scripts/backfill
for f in all_ai_models.csv eci_scores.csv; do curl -sSL -o cache/$f https://epoch.ai/data/$f; done
python3 gen.py            # then: node ../validate.mjs && node ../build-data.mjs
```

`verify.py`, `verify2.py` and `hf.py` hit the network (a few hundred requests) and rewrite their
JSON results; `gen.py` reads those results and does not.
