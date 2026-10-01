# Sequel plan: an interactive LLM lineage timeline

The hand-drawn SVG (see `archive/`) could not keep up. The sequel is an interactive 2D
flowchart on a timeline, generated from the curated dataset in `data/`, and kept current
by a weekly agent that proposes changes as PRs.

## Decisions

| | |
|---|---|
| Audience | Public explainer, hosted at kenan.schaefkofer.com/timeline |
| Scope | Frontier models + notable open-weight models (~150–300 nodes), 2018 to now |
| Lanes | Current 8 labs + Alibaba/Qwen, Moonshot, Zhipu, MiniMax; everything else in an "Other" lane |
| Lines | Documented derivation (solid) and cross-lab influence. Rumored/estimated edges dashed, and every edge cites a source |
| Succession | No arrows for same-lab succession. Product lines are sub-tracks inside a lane, so succession reads from position |
| Layout | Lab swimlanes by default. Toggle to Epoch Capabilities Index (ECI) on the vertical axis; unscored models sit in a strip along the bottom |
| Interaction | Pan/zoom over time; hover/click detail panels with lineage highlighting |
| Stack | Evolve existing `data/` + validator; SVG + D3, no framework; GitHub Pages via Actions |
| Updates | Weekly agent, Friday afternoon. Sources: lab announcements/docs, Epoch AI datasets, Hugging Face model cards, news/social for rumors. Opens a PR for review; nothing goes live unreviewed |

## Phases

### 1. Schema — done
Extend `data/SCHEMA.md` and `scripts/validate.mjs`:
- Model fields: `product_line` (sub-track within a lane), `org`, `modalities` (in/out),
  `open_weights` / `licence`, `hf_id`, `epoch_id`.
- New `data/lineage.yaml`: edges with `from`, `to`, `type`
  (`finetune | distill | quantized | variant | influence`), plus the existing
  `confidence` / `source` / `basis` fields. Rumored/estimated edges render dashed.
  An edge with no source fails validation.
- New `data/scores/eci.yaml`: score, source, retrieval date. Kept separate from curated
  facts; refreshed by the agent from Epoch's download.

### 2. Backfill
- 2018–2022 models (GPT-1/2/3, BERT, T5, Gopher, Chinchilla, PaLM, OPT, BLOOM, …), seeded
  from Epoch's notable-models dataset rather than typed by hand.
- Chinese open labs; Hugging Face `base_model` edges among tracked models.
- Hand-curated influence/rumor edges (e.g. DeepSeek distillation claims), each sourced.

### 3. Renderer
- Replace `site/js` with a D3 view: time axis, lanes, product-line sub-tracks, curved edges.
- d3-zoom with label detail that increases with zoom; detail panel.
- Animated toggle from lane positions to ECI y-positions.
- Make 2018–2022 readable: a time scale that compresses older years, or a default view
  zoomed into the recent period.

### 4. Deploy
- Actions workflow: validate → build → deploy to Pages on merge to `main`.
- Point `/timeline` at it.
- Generate a static PNG for the README, replacing the hand-drawn image.

### 5. Weekly agent
Scheduled Friday routine running a repo-local prompt (`scripts/curate.md`):
1. Diff each lab's model and deprecation pages against the data.
2. Pull the Epoch ECI update.
3. Scan Hugging Face for new `base_model` edges among tracked models.
4. Search news for releases and rumors.

It opens one PR with a changelog and a source on every claim, and `validate.mjs` must pass.
Rumor edges go in their own PR section so they can be skimmed separately.

## Open points
- Early/research labs (EleutherAI, BigScience, AI2) fall into "Other" for 2018–2022.
  Revisit if that lane gets crowded.
- Time zone for the Friday schedule — confirm when creating the routine.
