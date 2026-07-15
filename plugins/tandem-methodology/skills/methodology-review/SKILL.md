---
description: Read the reflective corpus (retros, defect log, auto-memory) and produce ranked, evidence-cited improvement proposals as `proposed` TEPs — or report reasoned silence when the corpus is below the evidence bar. Propose-only; the human holds every trigger.
allowed-tools:
  [
    "Read",
    "Grep",
    "Glob",
    "AskUserQuestion",
    "Task",
    "mcp__thinkube-kanban__get_thinkube_file",
    "mcp__thinkube-kanban__resolve_project_space",
    "mcp__thinkube-kanban__list_thinking_spaces",
    "mcp__thinkube-kanban__write_tep",
    "mcp__thinkube-kanban__write_retro_note"
  ]
argument-hint: "[--thinking-space=<id>] [--since=YYYY-MM-DD] [--window=<days>]"
thinkube-bundle: 0.0.1
---

# /methodology-review

Scan the **reflective corpus** — retro notes, `defects/*.jsonl` entries (structured defect data per TEP-22 — see `reference.md`), and auto-memory when present — then synthesize recurring patterns into **ranked, evidence-cited improvement proposals**. Each proposal that clears the evidence bar lands as a `proposed` TEP (Tandem Enhancement Proposal — the methodology's canonical artifact for the _why_ behind a proposed change) via `write_tep`. The human sees the proposals and decides; nothing is applied automatically.

> **Propose-only, enforced at two layers.** This skill's only write surfaces are `write_tep` (status `proposed`) and `write_retro_note` (the closing cover note). File-authoring tools are excluded from the `allowed-tools` list at the harness permission layer. The board server additionally offers no skill-mutating operation — so even a session with looser permissions has no tool that can apply a change to the methodology itself. This skill runs only as a **maintainer-triggered interactive session**, never as a `bypassPermissions` worker (where the allowlist would be void).

> **Self-referential flag.** A proposal that would change *this skill or its rubric* (`skills/methodology-review/SKILL.md`, `skills/methodology-review/reference.md`, or the root `methodology.md`) is legal but **flagged as self-referential** in its TEP body, so the human reads it with that lens. The agent proposing changes to its own governing process is exactly the self-grading failure mode Tandem exists to prevent — awareness and human oversight are the mitigations.

> **Silence is a first-class outcome.** When the corpus is below the evidence bar, this skill says so clearly, names what was scanned, and produces **zero TEPs**. A run that finds nothing to propose is a cheap, valid result, not a failure.

> **See `reference.md`** for the full channel-weighting doctrine, the synthesis rubric in depth, the evidence-bar definition, and worked examples of both a proposal and a reasoned silence. Load it on demand — the operational core is here.

## Mission

Scan the thinking space's reflective corpus for a bounded recent window (90 days by default). Cluster recurring (activity, trigger, type) signatures, weighting impact class above raw recurrence counts. Draft a `proposed` TEP per top-k cluster (k ≤ 5). Each TEP names the methodology seam that failed, proposes a fix at the right altitude, and cites the specific defect rows or retro entries that motivate it. Proposals without citations are discarded before surfacing.

## Inputs

- `$ARGUMENTS`: optional flags
  - `--thinking-space=<id>` — override thinking-space resolution (otherwise derived automatically).
  - `--since=YYYY-MM-DD` — restrict the corpus to entries on or after this date. Default: 90 days ago.
  - `--window=<days>` — shorthand for `--since` (e.g. `--window=30` = last 30 days). Ignored when `--since` is also set.

## Procedure

### 1 — Resolve the thinking space

Three-tier precedence (derive, don't guess):

1. If `--thinking-space=<id>` was passed, use it verbatim.
2. Otherwise call `resolve_project_space { cwd: <session root> }`. If it returns a non-null `namespace`, that is the thinking space — this is the normal path when the session is opened inside a project.
3. If `resolve_project_space` returns `namespace: null`, call `list_thinking_spaces` and ask the user with `AskUserQuestion` which thinking space to scan. One question, not a guess.

### 2 — Determine the corpus window

Parse `--since` or `--window` from the args. Default: 90 days ago through today. This window bounds which `retros/YYYY-MM-DD.md` files and `defects/YYYY-MM.jsonl` lines to include.

### 3 — Scan and cluster the corpus (volume-model pass)

Delegate corpus reading and clustering to a **read-only subagent** via `Task`. This is the volume-model pass: use a lighter model for parsing and pattern-finding, so the judgment-model time stays proportional to k, not to corpus size.

**Give the subagent the thinking space id and window, plus this mandate:**

- Read `defects/YYYY-MM.jsonl` for each month in the window via `get_thinkube_file`. Parse each line as a JSON object; skip and count malformed lines. Extract entries whose `ts` field falls within the window.
- Read `retros/YYYY-MM-DD.md` for each date in the window via `get_thinkube_file`. Skip dates with no file.
- Read auto-memory entries if a `memory/` directory or auto-memory file exists in the thinking space (`memory/notes.md` or similar) — include if found, skip if absent.
- Do **not** write anything.

**Ask the subagent to return a structured JSON report:**

```json
{
  "clusters": [
    {
      "activity": "verify: gate-infra",
      "trigger": "post-hoc diagnosis",
      "type": "lifecycle definition",
      "impact": "round lost",
      "count": 3,
      "evidence": [
        { "source": "defects/2026-07.jsonl", "ts": "2026-07-14", "detail": "…" }
      ],
      "retro_corroboration": [
        { "source": "retros/2026-07-14.md", "lens": "learned", "excerpt": "…" }
      ]
    }
  ],
  "corpus_summary": {
    "retro_files_read": ["retros/2026-07-14.md"],
    "defect_entries_read": 16,
    "parse_errors": 0,
    "memory_read": false,
    "window_start": "2026-04-16",
    "window_end": "2026-07-15"
  }
}
```

When ordering clusters, apply the **canonical Trigger catch-point order from TEP-22** (earliest/cheapest catch → latest/most expensive):

1. `authoring-time audit`
2. `fence denial / containment`
3. `build gate (prepare)`
4. `gate-verifier failure`
5. `judge contradiction`
6. `worker flag (⚠)`
7. `human challenge`
8. `post-hoc diagnosis`

A cluster whose dominant trigger falls near the **late end** of this list has the most to gain from a structural improvement (shifting it leftward on future defects). That opportunity weight feeds into the ranking in step 5.

### 4 — Apply the evidence bar

A cluster clears the evidence bar if **any one** of these holds:
- It has ≥ 2 matching defect entries, **or**
- It contains at least one `integrity`-impact entry (a false green — one is enough to motivate a proposal), **or**
- It has 1 defect entry corroborated by a matching retro observation.

**If no cluster clears the bar:**
- Print what was scanned (from `corpus_summary`), why no cluster cleared the bar, and that the run produced zero proposals.
- Log the outcome: `write_retro_note { thinking_space, lens: "blocked", note: "methodology-review: scanned N defect entries and M retro files for [window]; no cluster cleared the evidence bar — [reason]. Zero TEPs produced." }`.
- **Stop here.** Do not write any TEPs.

### 5 — Rank clusters and select top-k (k ≤ 5)

Weight in descending priority:

1. **Impact class first.** `integrity` clusters (false greens) always rank before all others, regardless of count or trigger position.
2. **Catch-point opportunity.** Among clusters of equal impact, those whose dominant trigger is nearer the late end of the canonical Trigger order rank higher — a class caught at `post-hoc diagnosis` has more opportunity to shift leftward than one already caught at `gate-verifier failure`.
3. **Recurrence count.** Among clusters of equal impact and trigger position, higher count ranks first.

Select the top-k (k ≤ 5) clusters that cleared the bar.

### 6 — Draft proposals (judgment-model step)

For each selected cluster, apply the synthesis rubric:

**a. Locate the seam, not the symptom.** Identify which Tandem stage *should* have caught this class before it reached the observed trigger. The gap between where it was caught and where it should have been caught names the seam.

**b. Propose at the right altitude.**

| Gap lives in | Proposal targets |
|---|---|
| A Spec's acceptance criteria or controllability | A change to `/spec-prepare` (a new auditor question, a strengthened constraint) |
| A slice's contract or classification | A change to `/slice` (a completeness rule, a new classification check) |
| A harness bug or missing gate | A new TEP (for a spec + implementation) |
| The skill text itself (wrong or ambiguous) | A skill-diff embedded in the TEP body |

**c. Prefer structure over judgment.** When the evidence shows an LLM-judgment layer erring (a judge misrouting, an audit passing what it should have caught), prefer proposing a structural guarantee (a fence, a schema check, an invariant) over a prompt tweak. Prompt tweaks are the right first step ("culture before machinery"); a structural fix is the right follow-through when reports show the prompt layer proved insufficient.

**d. One proposal, one evidence trail.** Every proposal must cite specific defect entries and retro excerpts — source file, `ts` or date, and the relevant `detail`. A proposal without citations is **discarded before surfacing**; do not include it in the output.

**e. Self-referential check.** If the proposed change targets any file under `skills/methodology-review/` or the root `methodology.md`, add this line in the TEP's `## Goal`: `⚑ SELF-REFERENTIAL — this proposal modifies the methodology-review skill or its governing rubric. The human holds every decision on self-referential proposals.`

**f. Embed skill-diffs in the TEP body.** When the fix is textual (a doc-level change to a skill file), write the concrete before/after text directly in `## Detailed Description`. Never leave a diff as a reply-only artifact: the TEP is the single durable record of both the evidence and the proposed change.

### 7 — Land each proposal

For each drafted proposal call:

```
write_tep { thinking_space: <id>, tep: <next-id>, title: "…", status: "proposed", body: "…" }
```

The TEP body must contain: `## Goal`, `## User Expectation`, `## Context` (with inline citations), `## Decision`, `## Detailed Description` (with skill-diff if doc-level), `## Consequences`, `## Alternatives Considered`, `## Implemented By` (`*(to be filled as specs are cut)*`).

Print the confirmed TEP id and path after each `write_tep`.

### 8 — Close with the ranked cover note

Call:

```
write_retro_note { thinking_space: <id>, lens: "learned",
  note: "methodology-review [window]: consumed M retro files, N defect entries, memory: yes|no.
         k proposals landed as proposed TEPs, ranked by evidence weight:
           1. TEP-{id}: <title> [integrity, N entries]
           2. TEP-{id}: <title> [round lost, N entries, post-hoc trigger]
           …
         ⚑ self-referential: TEP-{id} (if any).
         parse errors: P." }
```

Print the same summary in the session.

## Economics

The corpus-read and cluster pass (step 3) runs via `Task` — the volume model appropriate for parsing many files and producing a structured report. The proposal drafting (step 6) uses the judgment model (the session running this skill). For a large corpus, this keeps the expensive model time proportional to k (the proposals to write), not to the number of defect entries or retro files.

## Constraints

- **Propose-only, two-layer enforcement** — see the opening note. Never attempt to apply a proposal directly; route every accepted proposal through `/spec-prepare` → `/slice` → orchestrate.
- **Impact outranks recurrence** in all ranking decisions. One `integrity` defect outweighs several `contained` or `hygiene` recurrences.
- **Citations are mandatory.** A proposal without specific citations (defect entry source + ts, or retro file + date) is discarded before surfacing.
- **Silence is an outcome, not a failure.** When no cluster clears the evidence bar, produce zero TEPs and log the result.
- **Self-referential proposals are flagged, not discarded.** The human reads them with heightened scrutiny.
- **The human holds every trigger.** This skill runs on demand only; it never auto-runs.
- **Write for a global audience (plain English).** Short sentences, common words. Gloss methodology terms on first use: "TEP (Tandem Enhancement Proposal — the why behind a proposed change)."

## Output

When proposals are produced:

```
📋 methodology-review — YYYY-MM-DD to YYYY-MM-DD
   consumed: M retro files, N defect entries, auto-memory: yes|no
   proposals: k

   1. TEP-{id}: <title>    [integrity, N entries]
   2. TEP-{id}: <title>    [round lost, N entries, post-hoc trigger]
   …
   ⚑ self-referential: TEP-{id}   (if any)

   cover note → retros/YYYY-MM-DD.md
```

When silence is the outcome:

```
📋 methodology-review — YYYY-MM-DD to YYYY-MM-DD
   consumed: M retro files, N defect entries
   result:   corpus below evidence bar — <reason>
   proposals: 0
```

## Safety / fallback

- **`write_tep` or `write_retro_note` absent in this session.** STOP and say so; do not attempt to author TEP files using file-system tools (they would land in the code repo, not the thinking space). Fix: start a fresh session so `.mcp.json` loads the kanban server.
- **Corpus is empty (no retro files, no defect entries).** Report this honestly and produce zero TEPs. This is not an error — the thinking space simply has not accumulated reflective data yet.
- **`resolve_project_space` returns null and the user cannot name a thinking space.** STOP — there is no corpus to scan.
- **The scan subagent (Task) fails or returns unparseable data.** Log the failure in the cover note and stop. Do not guess at clusters without data.
- **`get_thinkube_file` returns not-found for all attempted paths.** Confirm the thinking space id is correct, then report the empty corpus and produce zero TEPs.
