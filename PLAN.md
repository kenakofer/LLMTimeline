# Interactive LLM lineage timeline: plan and status

The hand-drawn SVG (see `archive/`) could not keep up. The replacement is an interactive
timeline generated from the curated dataset in `data/`, to be kept current by a weekly agent
that proposes changes as PRs.

**Status (2026-10-02):** v1 is live at
[kenan.schaefkofer.com/timeline](https://kenan.schaefkofer.com/timeline/), served by GitHub
Pages from `main` of this repo (`kenakofer/timeline`; `index.html` is the page).

## Decisions

| | |
|---|---|
| Audience | Public explainer at kenan.schaefkofer.com/timeline |
| Scope | Frontier models + notable open-weight models, 2018 to now (226 models) |
| Lanes | 11 labs (OpenAI, Anthropic, Google DeepMind, Meta, DeepSeek, Mistral, xAI, Alibaba/Qwen, Moonshot, Zhipu, MiniMax) + "Other" with `org` attribution |
| Lines | Documented derivation only (fine-tune, distill, variant), from model cards and announcements. Unverified edges dashed; every edge cites a source. No inferred same-lab succession lines |
| Capability | Epoch Capabilities Index (ECI), from 2023; Epoch's frontier flag before that |
| Updates | Weekly agent (deferred). Opens a PR for review; nothing goes live unreviewed |

## v1 design (as built in `index.html`)

- **One card per model**, its left edge on the model's first public appearance. Cards are
  20px, or 30px for models within 4 ECI points of the best at launch (Epoch frontier flag
  before ECI).
- **Time axis stretched by release count**: each quarter's width is proportional to its
  releases (14px per release), so busy years get room and 2018–2022 stays compact.
- **Curved lab bands**: each band's top is the actual bottom of the band above; cards float up
  into free space, and the band pinches to a ribbon when the lab is quiet. Bands are not drawn;
  hovering a lab shows its band as a blurred glow. Spacing loosens to fill tall windows.
- **Founding pills** at each lab's founding date (`labs.yaml`); the logo pulls off the pill and
  sticks to the left edge as the chart scrolls.
- **Badges**: gold crown (new frontier at launch), download arrow (open weights), key (not
  publicly available), tombstone (retired); translucent card for `expected` models. Lab logo as
  an oversized watermark (Simple Icons / Lobe Icons; see `logos/NOTICE.md`).
- **Hover**: lineage (ancestors and descendants) highlighted, lifespan line and exact-date guide
  drawn above everything; the lab's other models stay half-lit.
- **Capability view**: cards animate to dots at their ECI height, with a stepped frontier line.

## Phases

### 1. Schema — done
Lineage edges (`data/lineage.yaml`), imported ECI scores (`data/scores/eci.yaml`), model
metadata fields, closed field set, reserved tags `frontier` and `expected`, lab founding dates.
See `data/SCHEMA.md`.

### 2. Backfill — done (2026-10-01)
226 models, 40 lineage edges, 156 ECI scores. Every pre-existing entry was re-checked against
first-party sources. The pipeline is kept in `scripts/backfill/` (see its README).

### 3. Renderer — v1 done
Remaining:
- Split `index.html` into modules and retire the old bar-chart page in `site/` (only its
  `data.js`/`data.json` build output is still used).
- Pan/zoom, with card density following the zoom level; re-fit layout live on resize.
- Accessibility: a table view of the data; keyboard focus for cards; touch-friendly tap
  instead of hover; check the light theme.
- Performance: the band glow blurs a ~3,500px-wide shape; pre-render it if it lags.
- Time scrubber ("what existed on this date?").
- Optional "inferred lineage" layer (faint, off by default) for undocumented links such as
  flagship → smaller tier distillation.

### 4. Deploy — partly done
Done: Pages serves `main`; `/timeline` on the personal site links to the live page.
Remaining:
- Actions workflow: validate → build on every push, failing the deploy on invalid data.
- Generate a static PNG for the README from the live page.
- Remove the root `drawing.png` copy once nothing embeds it (the personal site now uses
  `archive/drawing.png`).

### 5. Weekly agent — deferred
Scheduled Friday routine (time zone to confirm) running a repo-local prompt:
1. Diff each lab's model and deprecation pages against the data.
2. Pull the Epoch model and ECI updates; refresh `frontier` tags.
3. Scan Hugging Face for new `base_model` edges among tracked models.
4. Review `expected` tags; search news for releases.

It opens one PR with a changelog and a source on every claim, and `validate.mjs` must pass.
`scripts/backfill/` holds reusable pieces (date verification, HF lookups).

## Open points
- Lab-level distillation claims (OpenAI → DeepSeek, Jan 2025; Anthropic → DeepSeek/Moonshot/
  MiniMax, Feb 2026) name no specific models, so the edge schema cannot hold them yet.
- 14 lineage edges rest on Epoch AI's base-model field alone (`likely`); verify first-hand.
- Reasoning and modality badges need a curation pass to fill `tags` / `modalities`.
- 89 announcement dates are `likely` (Epoch AI, not found on the linked page) and
  availability is `estimated` where no source states it; the agent can upgrade these.
- OpenAI's logo comes from Lobe Icons after Simple Icons removed it; swap for a text mark if
  that preference should be respected.
- The old `site/` page is blank when opened from `file://` (module script).
