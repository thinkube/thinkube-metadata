# /methodology-review — reference

Depth and doctrine for `/methodology-review`. The always-loaded `SKILL.md` has the operational procedure; load this when you need channel-weighting rationale, the synthesis rubric in full, evidence-bar mechanics, or worked examples of a proposal and a reasoned silence.

---

## The reflective channels — what each contains

### `retros/YYYY-MM-DD.md` — narrative judgment

Retro files are the narrative layer. Each entry carries a **lens** (`kept` / `changed` / `learned` / `blocked`) and free-form text capturing what the maintainer noticed at reflection time. The format is:

```markdown
## YYYY-MM-DD HH:MM

### learned

PostgreSQL JSONB columns can't be indexed via GIN without an opclass.
```

**What retros carry well:**
- The causal chain behind a defect that the structured log can't encode ("the confessions leaked into a code comment because there was no UNDELIVERED slot").
- Cross-cutting observations that touch multiple defect entries at once.
- Pattern recognition at a higher altitude than any single defect row.
- Decisions already taken ("changed: culture before machinery, as a standing rule").

**What retros don't carry well:**
- Precise counts (how often something happened).
- The Activity / Trigger / Type / Impact breakdown needed for quantitative ranking.
- Which specific defects motivated which observation (unless the author linked them).

**Reading guidance:** A retro entry is strong corroboration for a cluster. It is weak as primary evidence on its own — the narrative altitude makes it easy to mistake a vivid anecdote for a recurring pattern. Always cross-reference with `defects/*.jsonl` before claiming a cluster exists.

---

### `defects/YYYY-MM.jsonl` — structured signal

Each line is one JSON object in the v1 ODC (Orthogonal Defect Classification — an IBM-origin technique adapted to Tandem) schema:

```json
{
  "ts": "2026-07-14",
  "spec": "21/1",
  "activity": "verify: gate-infra",
  "trigger": "post-hoc diagnosis",
  "type": "lifecycle definition",
  "qualifier": "missing",
  "impact": "round lost",
  "detail": "Held-out probes stored as untracked files in a reset-prone tester worktree; …"
}
```

Fields:

| Field | Values | Meaning |
|---|---|---|
| `ts` | YYYY-MM-DD | Date the defect was recorded |
| `spec` | `"<tep>/<sp>"` | The Spec where the defect occurred |
| `activity` | `spec-authoring` · `slicing` · `implementation (code)` · `implementation (test)` · `verify: gate-infra` · `verify: judging` · `verify: reporting` · `verify: lifecycle` · `accept` | Which Tandem stage owned it |
| `trigger` | See canonical order below | What exposed it |
| `type` | ODC artifact types + methodology types | Nature of the fix |
| `qualifier` | `missing` · `incorrect` · `extraneous` | Direction of the gap |
| `impact` | `integrity` · `round lost` · `mis-routed rework` · `prevented` · `contained` | How bad |
| `detail` | Free text | What happened and what fixed it |

**Canonical Trigger order (catch-point curve), from earliest/cheapest to latest/most expensive:**

1. `authoring-time audit` — caught at spec-prepare or slice time; no wasted run.
2. `fence denial / containment` — caught by a hard constraint or guard; minimal wasted work.
3. `build gate (prepare)` — caught before the full verifier runs.
4. `gate-verifier failure` — caught by the automated verifier; one wasted round.
5. `judge contradiction` — caught by a judge verdict; at least one rework round.
6. `worker flag (⚠)` — surfaced by the worker's own flag; wasted authoring effort.
7. `human challenge` — caught by the maintainer; expensive and unreliable as a permanent gate.
8. `post-hoc diagnosis` — caught retrospectively; maximum cost, and may mean a false green was already accepted.

This order is defined once in TEP-22/SP-1's exported aggregator module (`src/services/defectStats.ts`) and should be treated as the canonical authority. Do not re-derive it; reference it.

**What defects carry well:**
- Precise counts per (activity, trigger, type) triple.
- Impact classification (including the loudly-flagged `integrity` class).
- Temporal trends (whether a class is appearing more or less frequently).
- The catch-point curve: whether defects are being caught earlier after a process change.

**What defects don't carry well:**
- The causal chain and the broader pattern (the `detail` field has the specific case; the retro carries the generalization).
- Cross-cutting findings that don't map cleanly to one (activity, trigger, type) cell.

---

### Auto-memory — session-crossing observations

Auto-memory entries (notes recorded by the `/remember` command, typically appended to `CLAUDE.md` or stored in a `memory/` directory in the thinking space) carry cross-session observations the maintainer judged worth preserving. They are often the most distilled signal — something the maintainer has already elevated from a single event — but they accumulate slowly and lack the timestamp precision of the defect log.

**Reading guidance:** Treat an auto-memory entry as equivalent in weight to a retro `changed` entry: it represents considered judgment, not just observation, and carries extra weight when it corroborates a defect cluster.

---

## Weighing the channels

| Signal | Weight | When it is primary | When it is corroboration only |
|---|---|---|---|
| `integrity`-impact defect entry | Highest — one entry can motivate a proposal alone | Whenever present | — |
| Two or more matching defect entries | High — a cluster by definition | Recurring (activity, trigger, type) triple | — |
| One defect entry + retro corroboration | Medium — cross-channel agreement | When defect count is 1 | — |
| Retro entry alone | Low | Never sole primary signal | Corroborates a defect cluster |
| Auto-memory entry alone | Low | Never sole primary signal | Corroborates or adds context |

**The guiding principle:** the defect log provides the *quantity* signal; retros and memory provide the *quality* signal. A high-count cluster is strong even without retro corroboration. A retro observation alone is interesting but not enough to mint a proposal — it must map to at least one defect entry, or it belongs in the cover note as an observation, not a proposal.

---

## The evidence bar — concrete definition

A cluster clears the evidence bar if **any one** of these holds:

1. **≥ 2 defect entries** sharing the same (activity, trigger, type) triple (or the type is at one level of abstraction above — e.g., two `lifecycle definition` entries with different activities still form a cluster on type alone if the seam is the same).
2. **≥ 1 `integrity`-impact defect entry** (a false green — one is enough; false greens are the class that must never be quiet).
3. **1 defect entry + at least 1 corroborating retro or memory observation** pointing at the same seam.

A cluster that does **not** clear the bar is discarded silently from the ranking — it is not mentioned in the output beyond the cover note's aggregate count. Do not surface partial-evidence patterns as proposals; the evidence bar exists to prevent noise from reaching the human's decision queue.

---

## The synthesis rubric — full expansion

### Rule 1: locate the seam, not the symptom

The observable symptom is where the defect was caught (the trigger) and what broke (the detail). The seam is the definition or structural slot that was missing, making the defect possible. Every fix that worked in the TEP-21 marathon gave homeless information a sanctioned path (oracle store for probes, evidence widening, intent threading into the audit). Every fix that failed or was rightly rejected added a checker — checkers consume bandwidth, they do not create it.

**Diagnostic question:** "What artifact slot was missing that forced the defect to leak out as a symptom at the observed trigger?" If the answer is "none — this was a one-off coding error," that is not a methodology proposal; it is an implementation defect.

**Example application:** A cluster of three `post-hoc diagnosis` entries, type `lifecycle definition`, activity `verify: lifecycle`, all about gates being bypassed or missing. Symptom: the gate did not run. Seam: no definition in the methodology required the gate at that stage; it was advisory or absent from the orchestrated path. Proposal altitude: a methodology rule (lifecycle definition change), not a code fix.

### Rule 2: propose at the right altitude

The altitude of a proposal is where the fix needs to land to be durable:

- **Spec-authoring level** — the fix goes in `/spec-prepare`'s procedure or its AC-verifiability auditor questions. Appropriate when the defect class is "ACs that pass the auditor but fail intent" or "Design seams left unspecified."
- **Slice-authoring level** — the fix goes in `/slice`'s classification rules or contract-audit procedure. Appropriate when the defect class is "contracts that pass but diverge at implementation" or "footprint misclassification."
- **Methodology doctrine level** — the fix goes in `methodology.md` or a skill's procedure as a new rule. Appropriate when the defect class is a missing or wrong behavioral principle.
- **Structural / machinery level** — a new TEP for a harness change, a new gate, a new export. Appropriate when no existing document surface can carry the fix.

**The wrong-altitude trap:** Proposing a methodology rule when the real fix is structural (adding a check to the code), or proposing code when the real gap is in the documented expectations. A prompt-level fix (adding a rule to `methodology.md`) is always available, costs nothing to deploy, and should be proposed first; a structural fix is proposed when the evidence shows the prompt layer has already been tried and failed for that class.

### Rule 3: prefer structure over judgment

When the evidence shows an LLM-judgment layer erring on a class of defects:
- An audit that repeatedly certified ACs as verifiable when they were not → consider adding a **checkable invariant** the audit can't waive (a required field, a format constraint) rather than adding more instructions to the audit prompt.
- A judge that repeatedly mis-routed faults → consider a **route-explicit schema** (the judge returns a typed verdict that the harness validates) rather than better instructions.
- A worker that repeatedly confessed in code comments → consider an **UNDELIVERED protocol** (a mandatory structured output field) rather than a behavioral instruction.

Judgment (prompt text) is the right first step and often sufficient. Structural guarantees are the right follow-through when the evidence shows a pattern repeating after the prompt fix was already applied.

### Rule 4: one proposal, one evidence trail

Each surfaced proposal must carry, inline in the TEP's `## Context` section, the specific citations that motivated it. The format is:

```
Evidence:
- defects/2026-07.jsonl, 2026-07-14 (spec 21/1, activity: spec-authoring, impact: integrity):
  "Tricycle #1: all 13 ACs green while the surface never ran once …"
- defects/2026-07.jsonl, 2026-07-14 (spec 21/2, activity: spec-authoring, impact: integrity):
  "Tricycle #2: spec ACs pre-translated the person into the session API …"
- retros/2026-07-14.md (learned):
  "The intent→spec→contract→probe translation chain decays altitude at every hop …"
```

A proposal without this inline evidence block is discarded before surfacing. The requirement is non-negotiable: it is what makes a proposal auditable (the human can verify the reasoning) and what makes the methodology-review output qualitatively different from a general LLM summary.

---

## Skill-diffs embedded in TEPs

When the proposed fix is a textual change to a skill or doctrine document, the diff must live in the TEP body, not in a chat reply. The format is a fenced diff block in `## Detailed Description`:

```diff
--- a/plugins/tandem-methodology/skills/spec-prepare/SKILL.md
+++ b/plugins/tandem-methodology/skills/spec-prepare/SKILL.md
@@ -… @@
-   …old text…
+   …new text…
```

This makes the diff:
- Durable (the TEP is the canonical artifact).
- Reviewable (the board's review flow applies; the diff is part of the thing being approved).
- Traceable (the TEP's `## Context` cites the evidence; the diff shows the proposed fix; the link between them is one document).

A diff in a chat reply is lost when the session ends and cannot be reviewed through the board's normal flow.

---

## The self-referential case

A `/methodology-review` run can legitimately surface a proposal that changes `SKILL.md`, `reference.md`, or the rubric itself. This is not prohibited — the methodology does improve — but it is flagged for heightened scrutiny because:

1. The proposer and the subject are the same process (the methodology-review skill proposes a change to the methodology-review skill).
2. Drift in the rubric could make future proposals easier to surface — or harder to challenge — in ways that are not visible to the proposer.

**The flag does not block the proposal.** It appears as the first line of the TEP's `## Goal`:

```
⚑ SELF-REFERENTIAL — this proposal modifies the methodology-review skill or its
governing rubric. The human holds every decision on self-referential proposals.
```

The human reads this proposal with the understanding that they are being asked to validate a change to the very process that generated the proposal. That awareness is the mitigation; the normal review flow is otherwise unchanged.

---

## Worked example — a proposal

**Corpus:** `defects/2026-07.jsonl` contains two `integrity`-impact entries:
- spec 21/1, activity `spec-authoring`, trigger `human challenge`, type `AC verifiability/controllability`, detail: "Tricycle #1 — all 13 ACs green while the surface never ran once."
- spec 21/2, activity `spec-authoring`, trigger `human challenge`, type `AC verifiability/controllability`, detail: "Tricycle #2 — ACs pre-translated; intent fidelity lost."

Plus a `learned` retro entry from `retros/2026-07-14.md`: "The intent→spec→contract→probe translation chain decays altitude at every hop because each translator optimizes for what its consumer can probe."

**Step 4 (evidence bar):** Two `integrity` entries → clears the bar immediately.

**Step 5 (ranking):** `integrity` impact → rank 1.

**Step 6 (rubric application):**
- Seam: the AC-verifiability auditor certified criteria that exercised a surrogate (a component probe) instead of the stated subject. The seam that was missing: a question asking "does the proposed check exercise the stated subject directly, or a proxy for it?"
- Altitude: spec-authoring level — the fix goes in `/spec-prepare`'s auditor procedure (a new question for the controllability check).
- Structure vs judgment: the retro note says every translator optimizes for what its consumer can probe; a prompt addition to the auditor is right here, with the structural follow-up being a required `subject_fidelity` verdict field if the prompt fix proves insufficient.
- Evidence: two `integrity` entries + one retro entry (three citations total).

**Step 7 (write_tep):**

```
write_tep {
  thinking_space: "Platform/extensions/thinkube-tandem",
  title: "Subject-fidelity audit: the AC verifier must exercise the stated subject, not a proxy",
  status: "proposed",
  body: "## Goal\n\nAdd a subject-fidelity question to the AC-verifiability auditor … \n\n## Context\n\nEvidence:\n- defects/2026-07.jsonl, 2026-07-14 …"
}
```

---

## Worked example — reasoned silence

**Corpus:** `defects/2026-07.jsonl` contains one entry, `impact: contained`, `trigger: post-hoc diagnosis`, type `checking`, detail: "Stale delivery report shown — per-surface bandages keep failing on new paths."

No retro entries corroborate it. No auto-memory.

**Step 4 (evidence bar):** One `contained` entry with no corroboration → does not clear the bar. (`contained` impact means the defect caused no lost round or rework, only noise.)

**Step 4 (silence path):**

```
write_retro_note {
  thinking_space: "…",
  lens: "blocked",
  note: "methodology-review 2026-07-15 (window: 90d):
         scanned 1 defect entry, 0 retro files.
         No cluster cleared the evidence bar:
         - 1 contained-impact entry (stale delivery report); no corroborating signal.
         Zero TEPs produced. The corpus is below the evidence threshold for this window."
}
```

**Output:**
```
📋 methodology-review — 2026-04-16 to 2026-07-15
   consumed: 0 retro files, 1 defect entry, auto-memory: no
   result:   corpus below evidence bar — 1 contained-impact entry, no corroboration
   proposals: 0
```

This is correct, cheap, and honest. The run did not fail; the corpus simply did not have enough evidence to justify a proposal. Silence is the right outcome.

---

## When the corpus contains both high-signal and low-signal clusters

If the corpus contains some clusters above the bar and others below it, select only the clusters above the bar (up to top-k). Do not mix. Low-signal clusters appear only in the cover note's aggregate summary ("N clusters considered, M below evidence bar"), never as proposals.

---

## Relationship to TEP-22 and TEP-23

**TEP-22** defined the defect classification schema and the canonical Trigger order, and landed both the structured capture (observation points write to `defects/*.jsonl`) and the surfacing view (the three distribution tables). This skill is TEP-22's *consumer* — it reads the structured signal TEP-22 produces.

**TEP-23** is the parent of this skill: the goal of making the "synthesis loop" (evidence → locate seam → propose fix → human decides) repeatable and cheap. Every run of `/methodology-review` is one iteration of that loop. The first replay benchmark for this skill is the TEP-21 delivery marathon (the `defects/2026-07.jsonl` entries and `retros/2026-07-14.md`): running this skill against that corpus should approximately re-derive the fixes that marathon shipped — context threading (the intent-fidelity audit), the worker declaration protocol (UNDELIVERED), and instrument preflight (subject-fidelity audit).
