# Dataset schema and curation rules

This document is authoritative. `scripts/validate.mjs` enforces the mechanical parts;
the judgement calls are described here and are the curator's responsibility.

The dataset records **when frontier models existed and were available** — not how good they
were, how much they cost, or how large they are. Those attributes are optional metadata.
Lifecycle dates are the product.

---

## Files

| File | Contents |
|---|---|
| `data/labs.yaml` | Lab identity, display name, colour token, row order |
| `data/models/<lab>.yaml` | Models for one lab |

One file per lab keeps diffs small and lets separate curation passes touch separate files.

---

## Model entry

```yaml
lab: anthropic          # must match a lab id in labs.yaml
models:
  - id: claude-opus-4-1       # stable, kebab-case, never reused or renamed
    name: Claude Opus 4.1     # display name, as the lab writes it
    family: claude-4          # optional; groups related models
    api_name: claude-opus-4-1-20250805   # optional; exact API identifier
    tags: [frontier, reasoning]          # optional
    notes: |                             # optional prose for the detail panel
      Free-form context.
    events:
      - ...
```

`id` is a permanent key. If a lab renames a model, keep the `id` and change `name`.

### Optional metadata

Recorded only where it is cheap and reliable. Never blocks a model from being added.

```yaml
    context_window: 200000    # tokens
    params: "671B (37B active)"   # free text; MoE makes a number misleading
    open_weights: true
```

---

## Events

Every model has an `events` list. Each event is one dated point in the model's lifecycle.

### Type vocabulary (closed set)

| type | meaning |
|---|---|
| `training_cutoff` | Knowledge cutoff. Informational; does not draw a segment. |
| `internal` | First known existence or use inside the lab. |
| `limited` | Restricted external access — named partners, safety testers, waitlist. |
| `announced` | Public announcement: blog post, paper, keynote. |
| `available` | General availability — first broad access, API or product. |
| `deprecated` | Still functional, replacement assigned, retirement scheduled. |
| `retired` | Requests fail. The model is gone. |

Adding a type is a schema change: update this table, `validate.mjs`, and the renderer's
segment logic together.

`announced` and `available` are frequently the **same day** — that is fine and expected.
Record both anyway; the distinction matters for the cases where they differ by weeks.

### Event fields

```yaml
      - type: internal
        date: 2026-02-20        # required. ISO YYYY-MM-DD. Always a single point.
        precision: month        # required. day | month | quarter | year
        confidence: estimated   # required. confirmed | likely | estimated | rumored
        basis: >                # required when confidence is estimated or rumored
          METR frontier report attests internal availability "mid-February to
          mid-March 2026". Midpoint of the attested window taken.
        bounds:                 # optional. Provenance only — does not position the mark.
          earliest: 2026-02-15
          latest: 2026-03-15
        source: https://metr.org/blog/2026-05-19-frontier-risk-report/
```

#### `date`

Always a single date, even when the source gives a range. This is a deliberate design
choice: one point positions the mark unambiguously, and the uncertainty is carried by
`precision`, `bounds`, and `basis`.

When a source gives only a month, use the **15th**. Only a quarter: the midpoint month's
15th. Only a year: **July 1**. Then set `precision` accordingly — the renderer fades the
bar edge across the implied interval, so the ink covers exactly what the source supports.

#### `precision` — how sharply the date is known

Objective, derived from the source's own wording. Not a judgement about trust.

| value | source said | renderer |
|---|---|---|
| `day` | "on 5 August 2025" | hard vertical edge |
| `month` | "in August 2025" | gradient across that month |
| `quarter` | "in Q3 2025" | gradient across ~90 days |
| `year` | "in 2025" | gradient across the year |

#### `confidence` — how much the claim is trusted

Orthogonal to `precision`. A tweet giving an exact date is `day` + `rumored`. A first-party
blog post saying "last month" is `month` + `confirmed`.

| value | use when |
|---|---|
| `confirmed` | First-party documentation or announcement states it directly. |
| `likely` | First-party but hedged ("not sooner than"), or strong secondary reporting. |
| `estimated` | Inferred from indirect evidence. `basis` required. |
| `rumored` | Unconfirmed reporting or informal claims. `basis` required. |

#### `basis` — the honesty valve

Prose explaining an inferred date. **Quote the source's actual hedged language** rather than
paraphrasing it into false precision. "Partners had access 'for weeks' before the 7 April
announcement; ~3 weeks assumed" is good. "Internal since March" is not.

Surfaced verbatim in the tooltip, so it is read by users, not just curators.

#### `bounds`

When a source gives a window or a one-sided bound, record it. Both keys optional — a
"not sooner than" retirement date is `earliest` alone.

Does **not** position the mark. It exists so the tooltip can show the real constraint and
so a future renderer could draw whiskers without a data migration.

#### `source`

URL, required unless `confidence` is `estimated`/`rumored` **and** `basis` is present
(some inferences rest on several sources or on absence of evidence; put the reasoning in
`basis`). Prefer first-party and human-readable pages over raw CSVs or API endpoints.

Source URLs rot — both the OpenAI and Anthropic deprecation pages changed hosts between
2025 and 2026. `scripts/check-links.mjs` catches this. Record the URL that works *now*.

---

## Rules

**Unknown is expressed by omitting the event.** Never write `date: null` or a placeholder.
Absence is meaningful: the renderer draws a leading ellipsis for a missing `internal` event,
explicitly signalling "something happened before this, we don't know when". A fabricated
date is worse than a visible gap.

**Only add an `internal` event if you can write a concrete `basis` sentence.** Internal dates
are rarely knowable — labs describe the gap as "months" and METR works from attested *windows*.
If the evidence won't support a sentence, leave the event out. Expect fewer than a third of
models to have one; that sparsity is an honest finding, not a backlog.

**Best-source-first.** When passes conflict, first-party deprecation tables beat aggregators
beat reporting. Do not overwrite a `confirmed` date with a `rumored` one.

**Chronology must hold.** Events are ordered:

```
training_cutoff ≤ internal ≤ limited ≤ announced ≤ available ≤ deprecated ≤ retired
```

The validator enforces this. A genuine violation means either a data error or a lifecycle
the vocabulary doesn't cover — investigate, don't force it.

**Derived, not stored.** Model status (active/deprecated/retired) is computed from the latest
event, never written as a field. Storing it invites drift.

---

## Worked example — the hard case

Claude Mythos Preview exercises every part of the schema: internal use attested only as a
window, partner-restricted access before announcement, a public announcement that was *not*
general availability, and a general release reported only as "in coming weeks".

```yaml
  - id: claude-mythos-preview
    name: Claude Mythos (Preview)
    events:
      - type: internal
        date: 2026-02-20
        precision: month
        confidence: estimated
        basis: >
          METR frontier report attests the model was among those representing
          internal state-of-the-art in a "mid-February to mid-March 2026"
          assessment window. Midpoint taken.
        bounds: { earliest: 2026-02-15, latest: 2026-03-15 }
        source: https://metr.org/blog/2026-05-19-frontier-risk-report/
      - type: limited
        date: 2026-03-17
        precision: month
        confidence: estimated
        basis: >
          Anthropic said partner organisations had used Mythos Preview "for weeks"
          before the 7 April announcement; ~3 weeks assumed.
        bounds: { latest: 2026-04-07 }
        source: https://www.anthropic.com/claude/mythos
      - type: announced
        date: 2026-04-07
        precision: day
        confidence: confirmed
        basis: >
          Announced but explicitly not generally available — access limited to a
          small number of named partner organisations.
        source: https://www.anthropic.com/claude/mythos
```

Note what is *absent*: no `available` event, because at the time of writing general release
was reported only as "in coming weeks" (Reuters, 28 May 2026). When it lands, add the event
with a real date. Until then the bar honestly ends at limited-access.
