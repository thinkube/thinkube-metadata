# /slice — reference

Rarely-needed depth for `/slice`. The always-loaded `SKILL.md` keeps the operational core (Mission, Procedure, Constraints, Output) and points here for the conceptual deep-dives and edge cases below. Load this on demand — when you need the full rationale behind a slice-vs-fragment call, the work-unit parallelism model, or the re-slicing change-review.

## What a slice is (vertical, not a layer)

A slice is the unit that flows the thinking space and is the verification boundary — _one green_. The decisive test is **vertical, demonstrable capability**, not size or layer:

- **Slice (vertical — write a file):**
  - "Email/password login end-to-end — form → `POST /session` → validate → set cookie → redirect."
  - "A logged-in session survives a server restart."
  - "Logout end-to-end — button → `DELETE /session` → cookie cleared."
- **Not a slice (horizontal fragment — fold into the slice it serves):**
  - "Add the Redis session store." · "Write the session middleware." · "Wire the OAuth callback handler."
  - Each is one _layer_ of a slice; on its own it leaves the system half-built, demos nothing, and only makes sense once a sibling lands.

Slicing **by layer/file** ("the models slice", "the endpoints slice", "the Redis slice") is the anti-pattern — it recreates the tiny-task soup the Slice unit exists to prevent (a slice is **not** a renamed atomic task). When in doubt, ask: _if I commit only this, is the system demonstrably more capable?_ If no, it's a fragment — merge it into the vertical slice it belongs to.

## The second axis: work units (how the slice's work parallelizes)

Cutting the slice answers _what is one coherent "done."_ It does **not** decide how the work inside it runs. That is a **separate, orthogonal axis** — the slice's **work units**, the schedulable atoms the orchestrator runs across N parallel workers. Getting the slice right but the work units wrong is the **most common first-use mistake**, so hold the two apart:

- **Slice = the validation envelope.** One coherent, demonstrable "done," verified once. It can be sizable and span many files.
- **Work unit = an authoring atom inside the slice.** `{ footprint, consumes?, execution, note? }`. The orchestrator schedules these — many run **concurrently**.

**The one rule that decides parallelism: shared footprint.** Two work units must serialize **only if they edit the same file** (a shared footprint). Disjoint files → they run in **parallel**. Nothing else serializes them:

- **A runtime / deploy / import / logical order does NOT serialize authoring.** If playbook B _runs after_ A at deploy time, or module B _imports_ A, that says nothing about _writing_ the two files. The workers are not running the pipeline — they are **writing the files**, and disjoint files are written in parallel. Conflating "runs in sequence" with "author in sequence" is **the** trap.
- A genuine **authoring** dependency — unit B literally can't be written until A's output exists on disk (B edits a file A creates) — is expressed by B **`consumes`**-ing that artifact: the orchestrator resolves the edge globally by matching what B consumes against whichever unit's `footprint` produces it. These are rarer than they look.
- **Footprint-disjointness is necessary but not sufficient — go contract-first.** When two or more disjoint-file units must agree on a **shared contract** (an interface/type, a name/key, a schema, a wire message, a flag name), prose-pinning that contract in the slice body is **not** enough — prose-pinned conventions **diverge** (when the contract-first gate was itself built, the parallel implementers diverged on the opt-out-flag name precisely because it lived only as a slice-body convention). The fix: make the contract a **first-class unit** — a **contract-definition unit** authored up front — and have every implementer **and** the test **`consumes`** that contract node's artifact (never each other, never a prose-pinned convention). A contract node doesn't drift; a slice-body sentence does. The implementers still fan out in parallel — they all hang off the one contract node, so the parallelism is preserved.

### The dependency layer — one DAG, artifact-grounded edges

The **unit DAG is the only scheduling graph.** There is no slice-level dependency and no node-id dependency to author — **`consumes` + `footprint` are the only edge language**, and they **resolve globally over all of the Spec's units**: an edge runs from producer to consumer wherever one unit's `footprint` produces an artifact another unit `consumes`, no matter which slice each unit sits in. You never name another unit or another slice; you name the **artifact**, and the orchestrator wires the graph. The corollary is the only test for whether a dependency is real: **a later slice is not a dependency — if you can't name the artifact, there is no dependency.** A runtime / import / deploy order, a "this slice comes after that one" intuition, or a sense that work should land in sequence are **not** edges — they create one only when you can point to a concrete artifact one unit produces and another consumes.

**The canonical shape — one coherent slice, a parallel fan-out of its files:**

> A new multi-file component or feature — e.g. an Ansible component's lifecycle playbooks (`10_configure_keycloak`, `11_deploy`, `17_configure_discovery`, `18_test`, `19_rollback`, `00_install`), or a service's `models.py` + `routes.py` + `tests.py` — is **one coherent slice** (its "done" = the component works end-to-end, verified once) whose work units are a **`fan-out`, one per file, run in parallel**. The lifecycle is serial _at runtime_; authoring its disjoint files is not. Where those parallel files must agree on a **shared contract** (a shared type/name/key/schema/message), author it **contract-first** — define the contract in its own **contract-definition unit** and have every implementer **and** the test **`consumes`** that contract node's artifact, so the fan-out still runs in parallel but converges on one authority instead of a slice-body sentence that drifts. Incidental conventions with no cross-file contract (a private local var name) can still be pinned in the slice body; the slice verify catches any drift.

So: **slice by coherence, parallelize by footprint.** A multi-file slice is the norm, not a smell — don't collapse it into one serial blob, and don't shatter it into one-file slices.

### Classifying a slice's work units (Procedure step 3a, in full)

Coherence decided what the slice _is_; now decide how its work runs. Walk the slice's files (from its `files:` set / the Spec's File Structure Plan) and group them into work units. **Lead with the footprint test, not intuition:**

- **Footprint first — what must actually serialize?** Two units serialize **only on a shared footprint** (both edit the same file). Disjoint files → **parallel**. A runtime / deploy / import / logical order is **not** a reason to serialize — you are writing files, not running them (the trap; see "The second axis"). A true on-disk authoring dependency (B edits a file A creates) is expressed by B **`consumes`**-ing A's artifact — the edge the orchestrator resolves globally from footprints — not a merged unit.
- **Contract-first when disjoint units share a contract.** Disjoint footprints are necessary but **not sufficient**: if the parallel units must agree on a shared **contract** (interface/type, name/key, schema, message, flag name), don't prose-pin it (prose-pinned conventions diverge — the opt-out-flag-name divergence when the contract-first gate was built). Make it a **contract-definition unit** authored first, and have each implementer **and** the test **`consumes`** that contract node's artifact — never each other, never a slice-body convention. The implementers still fan out in parallel off the one node.

- **Same mechanical change over disjoint objects?** The _same_ edit per object (a rename across 8 files, a set-a-field codemod) → ONE **`mechanize`** unit whose footprint is _all_ the objects ("author one transform, apply across the set"). Don't mint a unit per object.
- **Heterogeneous per-file work?** Each file is a _different_ authoring task (the component-lifecycle case: keycloak vs deploy vs test) → a **`fan-out`** — **one unit per file**, each with a `note` stating its task, all parallel (disjoint footprints). This is the common multi-file shape.
- **Same file, steps that must be ordered?** Only _then_ is it **`serial`** — a shared-footprint chain authored in one ordered session. "Serial" means shared footprint, never "runs in sequence at runtime."
- **Peel structural changes:** a non-mechanical change adjacent to a `mechanize` group is its **own** unit, never folded in.

Record each slice's work units — each `{ footprint, consumes?, execution, note? }` — and **pass them to `create_slice` as `work_units` in step 6**. Classifying the shape in prose is not enough: **emitting the array is what instantiates the units** (omitting it is the SP-tgs8gb step-6 gap that left 0 slices with work units). For a `fan-out` unit give each its `note` (the per-object task) so a worker is self-describing. The slice stays the validation envelope; work units are never independently verified.

- **Declare the slice's file set.** List the repo-relative files the slice will edit (`files:`), drawn from the Spec's File Structure Plan. When two or more slices are meant to run **concurrently**, give them the same `parallel_group:` name — their `files` sets **must be disjoint** (the server refuses an overlapping group, naming the conflicting files). Cut parallel siblings file-disjoint up front so the merge is trivial; if two candidates must touch the same file, either sequence them (via a `consumes` edge on the shared artifact) or leave them ungrouped.

## Re-slicing — the Spec changed under existing slices (Procedure step 0, in full)

If `teps/TEP-{t}/SP-{n}/` already holds `SL-*.md` files, this is a **change-review**, not a fresh decomposition — the thinking space flags this with a stale badge (`specStale` / `specChange: "requirements"`) on done slices whose parent Spec was edited after they were verified. Do NOT overwrite blindly:

- Read the existing slice files (`get_slice { thinking_space: <id>, … }` per handle, or `get_thinkube_file { thinking_space: <id>, path: "teps/TEP-{t}/SP-{n}/SL-{m}.md" }`) and their `status:` (`ready` / `doing` / `done` / `archived`).
- Re-derive slices from the Spec's **current** Acceptance Criteria, then diff against what exists, classifying each as **keep** (still maps to an AC), **add** (an AC has no covering slice), or **obsolete** (no longer maps to any AC).
- **The action depends on the slice's status — never react uniformly:**
  | Status              | Action on change                                                                                                                                                            |
  | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | ready (not started) | revise / add / archive freely                                                                                                                                               |
  | doing               | do **not** edit or archive — flag it; ask the user whether to keep, rescope, or set back to ready                                                                           |
  | done                | leave it; if the change implies more work, propose a **new** slice. If it went substantively stale, let `/pair-next`'s sweep re-verify it — don't silently rewrite it here. |
- To retire an obsolete slice, set its frontmatter `status: archived` (keep the file — numbers are never reused). Don't delete.
- Present the keep/add/archive diff **annotated with each slice's status and the recommended action**; get the user's blessing before writing.

## AC verifiability at the gate (Procedure step 4, in full)

- **Flag any AC that isn't AI-verifiable at the gate it arms.** While mapping, an AC that can only be checked _after_ the gate it arms — a **human-executed** step ("the human verifies in a fresh session") or a **deploy/merge-circular** outcome (needs the merged/deployed result, but merge/deploy is gated on the AC) — is a **defect in the Spec, not a slice to mint**. Don't write a slice whose only "done" is such an AC; route it back to `/spec-prepare` to reframe (probabilistic → proxy + AI probe; deploy-circular → pre-merge/preview AC + a non-gating post-deploy smoke check). A genuine post-deploy confirmation is modeled as a **follow-up slice** that runs after the deploy, never as a Done condition of the deploying slice.
- **Re-run the verifiability auditor when you touch the ACs.** The opening gate (TEP-tgzx3p) requires every AC to carry a certified `ac_verifications` entry before → Ready, emitted by `/spec-prepare`'s auditor (its step 7). If slicing surfaces an AC change — a reframe, a split, a newly-added AC — the Spec's map is now stale or incomplete: route back to `/spec-prepare` to re-audit and re-emit the map before `create_slice`. `createSlice`'s `readyGate` refuses a Spec with any undeclared AC (naming the ordinal), so an un-re-audited AC blocks the whole slice batch — surface that refusal and fix it at the Spec, never by hand-editing frontmatter.

## Safety / fallback (in full)

- **Kanban MCP tools absent in this session.** STOP and say so — do **not** fall back to freehand `Write` (freehand creation is how format drift happened). Fix: start a fresh session in the repo (`.mcp.json` loads at session start).
- **Spec sections missing.** Refuse cleanly. Direct user to `/spec-prepare {n}`.
- **AC unmatched by any slice.** Don't silently invent one. Surface the gap (ask whether the AC is still valid) or fold it into an existing slice with the user's blessing.
- **A candidate has no single "done."** Reject it as a slice. Park it in the Spec's `## Design` / `## Constraints` instead.
- **A candidate has its own AC / design.** It's a Spec, not a slice. Surface this — the user may want a new Spec.
- **Spec is huge (>12 candidate slices).** Usually a sign the Spec should be split. Surface this before authoring files.
