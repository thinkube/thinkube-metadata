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
- **Footprint-disjointness is necessary but not sufficient — declare the contract at design time.** When two or more disjoint-file units must agree on a **shared contract** (an interface/type, a name/key, a schema, a wire message, a flag name), loose prose is **not** enough — prose-described interfaces **diverge** (a real run drifted `putApproval(subjectKey, token)` into `createApprovalStore(dir)` precisely because the contract was prose pseudo-code, and the acceptance tests written to the contract then didn't compile). The fix is the slice's **`contract`** field: **compilable interface signatures in the repo's language** — the exact export names, parameter and return shapes, and one-line behaviour notes (~10–20 lines) — written by the slicer at `create_slice` time. The orchestrator injects the union of every slice's contract into **every** worker's prompt, so all units converge on one precise authority. No contract work-unit and no `consumes` edge for interface agreement — the fan-out parallelism is untouched.

### The dependency layer — one DAG, artifact-grounded edges

The **unit DAG is the only scheduling graph.** There is no slice-level dependency and no node-id dependency to author — **`consumes` + `footprint` are the only edge language**, and they **resolve globally over all of the Spec's units**: an edge runs from producer to consumer wherever one unit's `footprint` produces an artifact another unit `consumes`, no matter which slice each unit sits in. You never name another unit or another slice; you name the **artifact**, and the orchestrator wires the graph. The corollary is the only test for whether a dependency is real: **a later slice is not a dependency — if you can't name the artifact, there is no dependency.** A runtime / import / deploy order, a "this slice comes after that one" intuition, or a sense that work should land in sequence are **not** edges — they create one only when you can point to a concrete artifact one unit produces and another consumes.

**The canonical shape — one coherent slice, a parallel fan-out of its files:**

> A new multi-file component or feature — e.g. an Ansible component's lifecycle playbooks (`10_configure_keycloak`, `11_deploy`, `17_configure_discovery`, `18_test`, `19_rollback`, `00_install`), or a service's `models.py` + `routes.py` + `tests.py` — is **one coherent slice** (its "done" = the component works end-to-end, verified once) whose work units are a **`fan-out`, one per file, run in parallel**. The lifecycle is serial _at runtime_; authoring its disjoint files is not. Where those parallel files must agree on a **shared contract** (a shared type/name/key/schema/message), pin it in the slice's **`contract`** field — precise, compilable signatures injected into every worker's prompt — so the fan-out still runs in parallel but converges on one authority instead of a slice-body sentence that drifts. Incidental conventions with no cross-file contract (a private local var name) can still be pinned in the slice body; the slice verify catches any drift.

So: **slice by coherence, parallelize by footprint.** A multi-file slice is the norm, not a smell — don't collapse it into one serial blob, and don't shatter it into one-file slices.

### Classifying a slice's work units (Procedure step 3a, in full)

Coherence decided what the slice _is_; now decide how its work runs. Walk the slice's files (from its `files:` set / the Spec's File Structure Plan) and group them into work units. **Lead with the footprint test, not intuition:**

- **Footprint first — what must actually serialize?** Two units serialize **only on a shared footprint** (both edit the same file). Disjoint files → **parallel**. A runtime / deploy / import / logical order is **not** a reason to serialize — you are writing files, not running them (the trap; see "The second axis"). A true on-disk authoring dependency (B edits a file A creates) is expressed by B **`consumes`**-ing A's artifact — the edge the orchestrator resolves globally from footprints — not a merged unit.
- **Contract when disjoint units share a seam.** Disjoint footprints are necessary but **not sufficient**: if the parallel units must agree on a shared **contract** (interface/type, name/key, schema, message, flag name), don't prose-pin it (prose-described interfaces diverge). Write it in the slice's **`contract`** field — compilable signatures, exact names — which the orchestrator injects into every worker's prompt. Never route interface agreement through `consumes`; the implementers fan out in parallel, each building to the injected contract.

- **Same mechanical change over disjoint objects?** The _same_ edit per object (a rename across 8 files, a set-a-field codemod) → ONE **`mechanize`** unit whose footprint is _all_ the objects ("author one transform, apply across the set"). Don't mint a unit per object.
- **Heterogeneous per-file work?** Each file is a _different_ authoring task (the component-lifecycle case: keycloak vs deploy vs test) → a **`fan-out`** — **one unit per file**, each with a `note` stating its task, all parallel (disjoint footprints). This is the common multi-file shape.
- **Same file, steps that must be ordered?** Only _then_ is it **`serial`** — a shared-footprint chain authored in one ordered session. "Serial" means shared footprint, never "runs in sequence at runtime."
- **Peel structural changes:** a non-mechanical change adjacent to a `mechanize` group is its **own** unit, never folded in.
- **Cluster by footprint (the closing pass).** Grouping can leave two units that would touch the **same path** — a `serial` chain and a stray `fan-out` unit on the same file, or two heterogeneous tasks that both land in one doc. **Merge them into one unit.** The classifier's output is **footprint-partitioned: one unit per disjoint file set** — a single worker owns each file, because two authors on one file _is_ the shared-footprint conflict the whole footprint test exists to prevent. Clustering is a pure _merge_: it never splits a unit or drops work, only folds same-path units together. (Worked case: a skill whose `SKILL.md` + `reference.md` are two files of one document, or a spec whose two sibling edits share a config file, cluster into **a single unit** — this Spec's own `/slice` edit is exactly that: `SKILL.md` + `reference.md` are one skill's docs → one clustered `role: "code"` unit, not two.)

Record each slice's work units — each `{ footprint, consumes?, execution, role?, note? }` — and **pass them to `create_slice` as `work_units` in step 6**. Classifying the shape in prose is not enough: **emitting the array is what instantiates the units** (omitting it is the SP-tgs8gb step-6 gap that left 0 slices with work units). For a `fan-out` unit give each its `note` (the per-object task) so a worker is self-describing. The slice stays the validation envelope; work units are never independently verified.

- **Declare the slice's file set.** List the repo-relative files the slice will edit (`files:`), drawn from the Spec's File Structure Plan. When two or more slices are meant to run **concurrently**, give them the same `parallel_group:` name — their `files` sets **must be disjoint** (the server refuses an overlapping group, naming the conflicting files). Cut parallel siblings file-disjoint up front so the merge is trivial; if two candidates must touch the same file, either sequence them (via a `consumes` edge on the shared artifact) or leave them ungrouped.

## The role axis — who _grades_ the slice (Procedure step 3c, in full)

Coherence decided what the slice _is_; footprint decided how its authoring _parallelizes_. A **third, orthogonal dimension** on each work unit decides **who grades the result**: the unit's **`role`**. It is independent of both `execution` and `footprint` — a `role` says nothing about serialization, only about which hand writes which artifact.

- **`role: "code"` (the default).** Authors the implementation. Every unit the footprint classifier produces is a code-author unit; omit `role` and it defaults to `"code"`. Its prompt carries the Spec's INTENT view (the `## Acceptance Criteria` are stripped) plus the injected contract.
- **`role: "test"` (the test-author).** Writes the slice's **acceptance tests** — the runnable checks that grade the slice's "done":
  - **Footprint = the repo's acceptance-probe path**, declared in `.tandem/conventions.json` (`acceptanceProbe.sourcePath`) and filled with the spec id and **each AC ordinal the slice `satisfies`** — one probe file per AC. **One canonical fill rule:** `{spec}` is the composite `<tep>/<sp>` id sanitized path-safe (every non-`[A-Za-z0-9._-]` run → `_`, so spec `6/3` fills as `6_3`; the TEP segment keeps probes from colliding across TEPs); `{ac}` is the 1-based ordinal. Each filled path corresponds exactly to the `ac_verifications` command the auditor declared for that AC, so the written probe and the run command always match. **Tech-agnostic:** the repo supplies the language and, via the recipe's optional `prepare` field, the build step the gate runs once before the per-AC commands (this extension: `src/acceptance/SP-{spec}_AC-{ac}.test.ts`, `prepare: npx tsc -p tsconfig.test.json`, run by `node --test`; a Python repo declares a `pytest` path and no `prepare`).
  - **Decompose per-AC by the same footprint rule as code:** distinct ACs → one `role: "test"` unit **per AC** (fan-out); ACs sharing a heavy harness → cluster into one unit whose footprint is those probe files.
  - **`consumes` nothing.** The test-author builds against the injected **contract + the ACs** (both in its prompt) — interface agreement is the contract's job, never a dependency edge. It runs **fully parallel with the code-authors**.
- **The workspace model (structural independence).** The orchestrator runs every `role: "test"` unit in the Spec's **tester worktree** — a detached snapshot at the Spec branch's committed HEAD. The tester reads and writes in that ONE directory; the code workers' in-progress modifications **do not exist in its tree**, so its tests grade the contract's meaning, not the implementation's quirks — by construction, not by a fence. (Committed earlier slices, being part of the branch, are legitimately visible.) When the slice's units all land, the orchestrator copies the finished probes into the code worktree, runs the recipe's `prepare` once, then the per-AC commands — the grade comes only from those independently-authored tests.

**Why independent.** A worker that writes both the code and its test grades itself — it tends to encode the same misreading into both, or to write the probe to pass the code it just wrote. Authoring the tests in a snapshot that does not contain the implementation forces them to commit to the _contract's_ meaning, so a green is evidence the implementation meets the agreed shape, not that one author agreed with themselves.

**Worked example.** In a Python repo whose `.tandem/conventions.json` declares `acceptanceProbe.sourcePath: "acceptance/SP-{spec}_AC-{ac}.py"` (run by `pytest`, no `prepare`), a slice "Email/password login end-to-end" of TEP-2/SP-5 that `satisfies` AC 2, with a contract pinning `create_session(email, password) -> Session | None`, fans out into `role: "code"` units for `models.py`, `routes.py` plus **one `role: "test"` unit**: `{ footprint: "acceptance/SP-2_5_AC-2.py", execution: "fan-out", role: "test", note: "a valid login form POST creates a session, sets the cookie, and redirects" }` — the path is the recipe filled with `(spec=2/5 → 2_5, ac=2)`. All three run concurrently — the code units in the spec worktree, the test unit in the tester snapshot — and the test-author never sees `models.py`/`routes.py` in progress. (A TypeScript repo would instead declare `src/acceptance/SP-{spec}_AC-{ac}.test.ts` with a `tsc` `prepare`; the methodology is identical, only the repo's recipe differs.)

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
