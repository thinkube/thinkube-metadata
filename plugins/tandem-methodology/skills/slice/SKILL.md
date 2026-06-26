---
description: Decompose a Spec into coherent end-to-end Slices at teps/TEP-{t}/SP-{n}/SL-{m}.md. MUST BE USED when the user says "slice", "decompose the spec", "break this into slices", or "create slices for SP-X". Do not hand-author slice files yourself.
allowed-tools:
  [
    "Read",
    "Write",
    "Edit",
    "Grep",
    "Glob",
    "mcp__thinkube-kanban__list_board",
    "mcp__thinkube-kanban__get_slice",
    "mcp__thinkube-kanban__get_thinkube_file",
    "Task",
  ]
argument-hint: "<spec-number>"
thinkube-bundle: 0.0.1
---

# /slice

Read a fully-shaped Spec and cut it into **coherent slices** — each one an end-to-end change you can verify-and-commit as a single "done." Each slice is written **directly** as its own file at `teps/TEP-{t}/SP-{n}/SL-{m}.md` (alongside its Spec in the org-scoped tree; `{t}` is the parent TEP) with `status: ready`. There is no checkbox-list intermediate, no materialiser, no issue minting — the files _are_ the board.

> **Decision-point protocol** (methodology `CLAUDE.md`): this is _human-paced_ authoring — converse → options → research → **read-back** → the human's explicit **"go."** Surface options as prose, never force convergence, and **approve ≠ execute**.

## Mission

Write one `teps/TEP-{t}/SP-{n}/SL-{m}.md` file per slice, where each slice:

- Is **one coherent, vertical, end-to-end change** — a thin cut through whatever layers the change touches that, once verified green and committed, leaves the system **observably more capable** (you could demo it).
- Has a **single statable "done"** (one green from the verifier).
- Is titled by the **concrete capability it delivers** ("Email/password login end-to-end"), not by a vague whole-feature outcome ("Auth works") and **not by a layer or file** ("Add the Redis store").
- Lands at `status: ready`, `parent: SP-{n}`, with a stable `uid`, a **short `# title` heading** (the concrete capability, ≤ ~70 chars) and a brief detail body — title and body are separate; never one merged line.
- Traces back to the Spec's `## Acceptance Criteria` — every AC maps to at least one slice.

Slices are sized by **coherence, not the clock**. If you can't state a single "done" for a row, it's more than one slice — split it. If a row has its own distinct acceptance criteria / design, it's not a slice — it's another Spec.

## The two axes (the core distinction)

Two orthogonal decisions govern slicing. Keep them apart — conflating them is the **most common first-use mistake**:

- **Coherence — what one slice _is_.** A slice is a **vertical, demonstrable capability** with a single statable "done" (one green), not a layer/file. "Email/password login end-to-end" is a slice; "Add the Redis session store" / "Write the session middleware" are horizontal fragments — fold each into the vertical slice it serves. Test: _if I commit only this, is the system demonstrably more capable?_ If no, it's a fragment.
- **Footprint — how the slice's work _parallelizes_.** Inside the slice, **work units** (`{ footprint, execution, note? }`) are the schedulable atoms the orchestrator runs across N workers. They serialize **only on a shared footprint** (both edit the same file) — disjoint files run in **parallel**. A runtime / deploy / import / logical order does **NOT** serialize authoring: the workers write files, they don't run the pipeline — conflating "runs in sequence" with "author in sequence" is **the** trap. A multi-file slice (a `fan-out`, one unit per file) is the norm, not a smell.

So: **slice by coherence, parallelize by footprint.** See `reference.md` ("What a slice is", "The second axis") for the full rationale, the canonical Ansible-lifecycle / `models.py`+`routes.py`+`tests.py` fan-out example, and the per-execution-kind (`serial` / `mechanize` / `fan-out`) classification.

## Inputs

- `$ARGUMENTS`: the Spec id `{n}` — a sequential integer minted per board+org (`SP-1`, `SP-2`, …). The spec and its slices nest under the parent TEP `{t}` (from the spec's `implements:`).

## Context discipline

The parent Spec is your scope — gather only what it doesn't already give you:

- **The slice shape is authoritative and enforced.** The canonical slice shape lives in this skill and is serialized by `create_slice` — **never read other slice files to learn the format.** Reading neighbours "for the format" is wasted context and copies their drift.
- **The Spec's `## Design` and `## File Structure Plan` already name the seams.** Decompose from them (step 3); don't re-derive what `spec.md` and `CLAUDE.md` already state.
- **`CLAUDE.md` before any codebase search.** Consult it and the docs first; search the code only for what they don't answer.
- **Exploration validates, it doesn't re-discover.** Any codebase look exists only to check the Spec's File Structure Plan against reality — do the named files/seams exist as described? — not to re-explore the architecture. Delegate a genuine "what's in this codebase" check to the `explorer` subagent to keep the main context lean.
- **No uninstructed reads.** Don't call tools the task didn't ask for "just in case." Load the Spec; read existing slice files only when re-slicing (step 0).

## Procedure

0. **Detect re-slicing (the Spec changed under existing slices).** If `teps/TEP-{t}/SP-{n}/` already holds `SL-*.md` files, this is a **change-review**, not a fresh decomposition (the board flags it with a `specStale` / `specChange: "requirements"` badge). Do NOT overwrite blindly: read the existing slices and their `status:`, re-derive from the Spec's **current** ACs, diff (keep / add / obsolete), and present the diff annotated with each slice's status for the user's blessing before writing. The action depends on status (ready → revise freely; `doing` → flag, don't touch; `done` → leave it, propose a new slice). See `reference.md` ("Re-slicing") for the full status table and rules.
1. **Read methodology context** + `repo-conventions` for branch/commit rules that may influence slice ordering.
2. **Load the Spec.** Use `get_thinkube_file teps/TEP-{t}/SP-{n}/spec.md` for the full body. If the spec is missing the four canonical sections (Acceptance Criteria / Constraints / Design / File Structure Plan), **stop** and direct the user to `/spec-prepare {n}` first.
3. **Brainstorm slices privately.** Working through the Design + File Structure Plan, draft candidate slices — cut **vertically** (coherent end-to-end behaviours), not by layer/file. For each, check:
   - **Is it demonstrable on its own?** If committing only this slice would leave the system half-built (a layer with nothing using it), it's a horizontal fragment — fold it into the vertical slice it serves.
   - Can you state a **single "done"** for it (one green)? If not, it's more than one slice — split it.
   - Does it have its own distinct AC / design? Then it's a **Spec**, not a slice — surface that to the user.
   - Is it a spike / investigation / "confirm X" with no verifiable output? Then it is **not a slice** — it belongs in the parent Spec's `## Design` / `## Constraints`. Don't write a file for it.
   - Does it depend on another slice? Note it for `depends_on`. Can it run independently of its siblings (no shared file/state edits, no required ordering)? If so, mark `parallel: true` — _parallel-eligible_, not must-run-in-parallel.
     3a. **Classify the slice's work units — the parallelism axis (footprint, not coherence).** Walk the slice's files and group them, **footprint first**: units serialize **only on a shared footprint**; the same mechanical edit over disjoint objects → ONE **`mechanize`** unit (footprint = all objects); heterogeneous per-file work → a **`fan-out`** (one unit per file, each with a `note`, all parallel); a same-file ordered chain → **`serial`**. A runtime/import order never makes units `serial`. Record each `{ footprint, depends_on?, execution, note? }` and **pass them to `create_slice` as `work_units` in step 6** — emitting the array is what instantiates the units (omitting it was the SP-tgs8gb gap). Also **declare the slice's `files:` set** (repo-relative, from the File Structure Plan); concurrent siblings share a `parallel_group:` and their `files` sets **must be disjoint** (server-enforced). See `reference.md` ("Classifying a slice's work units") for the full footprint test, the `mechanize`/`fan-out`/`serial`/peel-structural rules, and the conventions-vs-`depends_on` distinction.

4. **Map back to acceptance criteria — and keep the ordinals.** For each AC line, identify which slice(s) satisfy it, recording its **1-based ordinal** (its position in the Spec's `## Acceptance Criteria`). If an AC is unmatched, add a slice. If a slice isn't traceable to any AC, drop it (or surface the gap — the AC may be missing). Each slice's ordinal list is passed to `create_slice` as `satisfies` (step 6) so the mapping lives in frontmatter, not prose — that's what arms the → Done gate. While mapping, **flag any AC that isn't AI-verifiable at the gate it arms** (a human-executed or deploy/merge-circular check) and **re-run `/spec-prepare`'s verifiability auditor whenever you touch the ACs** — both are Spec defects routed back to `/spec-prepare`, not slices to mint, and an un-re-audited AC blocks the whole batch at `createSlice`'s `readyGate`. See `reference.md` ("AC verifiability at the gate") for the reframe recipes and the follow-up-slice rule.
5. **Propose in chat.** Show the proposed slice list with rationale and the SL numbers you'll allocate. Wait for user feedback.
6. **Create the files via `create_slice` — never freehand.** For each agreed slice, call `mcp__thinkube-kanban__create_slice` with `{ spec: {n}, title, body, satisfies?, depends_on?, parallel?, parallel_group?, files?, work_units?, docs?, docs_reason?, priority? }`. The **server** allocates the SL number (per-Spec, archive-aware), generates the uid, and serializes the canonical shape — you never pick numbers or format files. The tool refuses over-long titles (> 70 chars) and Specs with empty Acceptance Criteria; surface a refusal verbatim, fix the input, retry.
   - `title`: the concrete capability, short — it becomes the card title.
   - `body`: 2–4 lines of detail — what the coherent end-to-end cut includes and what the observable "done" looks like. Title and body are **separate**; never collapse them into one merged line.
   - `satisfies`: the AC ordinals from step 4 (e.g. `[2, 3]`) — the 1-based positions of the criteria this slice delivers. Recording it arms the → Done gate (the slice can't reach Done until those boxes are checked on the Spec); omit it only when the slice genuinely maps to no single AC.
   - `files` / `parallel_group`: the slice's **machine-readable file set** (repo-relative paths it will edit) and, when it runs concurrently with siblings, the **named group** they share. The server refuses a `parallel_group` whose members' `files` overlap — surface that refusal verbatim, then re-cut the slices file-disjoint (or sequence them with `depends_on`).
   - `work_units`: the execution-aware units classified in step 3a — each `{ footprint, depends_on?, execution: serial|mechanize|fan-out, note? }`. **Emit this** — it is the SP-tgs8gb instantiation (the older skill classified shape but dropped the param): a uniform multi-object change → **one** `mechanize` unit whose footprint is all objects; heterogeneous per-file work → **one `fan-out` unit per file**, each with its `note`, run in parallel (disjoint footprints); a shared-footprint ordered chain → `serial`. A runtime/import order never makes units `serial` — only a shared footprint does (see "The second axis"). The slice stays the validation envelope; SP-tgs8nz's scheduler runs the units.
   - `docs`: the **documentation obligation** (TEP-tgh6iy). Default `required` — any **user-facing** slice (a feature, CLI, API, config surface, install/upgrade step, or template behavior a user can observe) must update its doc module to reach Done. Pass `docs: "n/a"` **with a one-line `docs_reason`** for work that changes nothing observable (internal refactor, test-only, infra) — the server rejects an `n/a` with no reason, so skipping docs is always a visible, deliberate choice. Default to `required` when unsure (fail closed).

7. **Report — do NOT commit.** The `board-autosave` Stop hook commits + pushes the board sidecar at turn end; it owns board bookkeeping, so a manual `git commit` is redundant (and was only ever needed while the hook was unwired). Just print the slice count and the next step: advance the Spec's slices from the board (the Orchestrate command).

## Constraints

- Slices are **vertical, demonstrable changes** with one statable "done" — cut end-to-end, never by layer/file. A slice that isn't independently demonstrable is a fragment; merge it.
- Title by the **concrete capability delivered**, not a vague whole-feature outcome and not a layer name.
- **Allocate `SL-{m}` as `max+1`, counting archived files.** Numbers are never reused — collisions corrupt the board's links.
- **`depends_on` uses full handles** (`SP-{n}_SL-7`), not bare numbers. **`parallel: true`** marks a slice sharing no files/state with its siblings (parallel-eligible, not must-run-in-parallel). **`parallel_group`** names a set of slices meant to run concurrently — their **`files` sets must be disjoint**, enforced server-side at `create_slice`.
- **No checkbox list, no materialiser, no issue minting.** Write the slice files directly. The board reads `status:` from frontmatter.
- A row with no single verifiable "done" is **rejected** — it goes in the Spec (`## Design` / `## Constraints`), not on the board.
- A slice's "done" must be **AI-verifiable at the gate it arms** — never a human-executed check or a deploy/merge-circular outcome. Such an AC is routed back to `/spec-prepare`; a real post-deploy confirmation is a follow-up slice, not a Done condition.

## Output

```
✅ SP-{n} sliced
   wrote:   SP-{n}_SL-1 … SP-{n}_SL-{m}  (<count> slices, all status: ready)
   at:      teps/TEP-{t}/SP-{n}/SL-*.md
   ac-coverage: <covered>/<total> ✔
   next:    advance from the board (Orchestrate)
```

## Safety / fallback

Refuse cleanly on the common failure modes — **kanban MCP tools absent** (STOP, never freehand `Write`), **Spec sections missing** (direct to `/spec-prepare {n}`), **an unmatched AC** (surface the gap, don't invent a slice), **a candidate with no single "done"** (park it in the Spec), **a candidate with its own AC/design** (it's a Spec), and **a huge Spec >12 candidate slices** (propose a split). See `reference.md` ("Safety / fallback") for each case in full.
