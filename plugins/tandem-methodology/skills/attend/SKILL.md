---
description: Run the human fix session for a requires-attention slice or a rejected-Spec rework — read the failure evidence, re-align the behaviour in the Spec's worktree, verify, COMMIT the fix to the spec branch, and hand back to the loop. MUST BE USED when a session is opened via /attend with a slice handle or a Spec id.
allowed-tools:
  [
    "Read",
    "Grep",
    "Glob",
    "Edit",
    "Write",
    "Bash",
    "AskUserQuestion",
    "mcp__thinkube-kanban__get_slice",
    "mcp__thinkube-kanban__get_thinkube_file",
    "mcp__thinkube-kanban__move_slice",
    "mcp__thinkube-kanban__update_slice",
    "mcp__thinkube-kanban__write_spec",
    "mcp__thinkube-kanban__patch_spec_section",
    "mcp__thinkube-kanban__create_slice",
    "mcp__thinkube-kanban__write_tep",
    "mcp__thinkube-kanban__write_retro_note",
    "mcp__thinkube-kanban__resolve_project_space",
    "mcp__thinkube-kanban__list_thinking_spaces",
    "Task",
  ]
argument-hint: "<slice-handle | spec-id> <worktree path + failure evidence…>"
thinkube-bundle: 0.0.1
---

# /attend

Run the **human fix session** for one board item the loop could not close on its own: either a **slice in `Requires-attention`** (bounded rework and the automated auto-attend fixer both failed) or a **Spec that was rejected at review**. The session re-aligns the behaviour, verifies, **commits the fix to the spec branch**, and hands the item back to the board loop — then it ends.

This session runs in the **canonical repo** (your cwd). The Spec's disposable worktree — where the fix is applied and committed — is named in the prompt that opened this session. Because the session does not live inside that worktree, it survives the worktree's retirement at Accept; there is no close-this-session ritual.

> **Determining the thinking space — derive, don't guess.** Every kanban call takes `thinking_space=<id>` — there is no cwd default. Precedence, stopping at the first that resolves: **(1)** an explicit `thinking_space` in the args wins; **(2)** else call `resolve_project_space { cwd: <session root> }` and use the returned `namespace` if non-null; **(3)** else **ask the user** which thinking space before any read.

> **You reach this session AFTER the machines gave up.** By the time a human sees requires-attention, the orchestrator has already: retried with judge-routed rework (bounded), self-healed unrunnable probes via the auditor, stopped deterministic identical failures early, and burned its one auto-attend attempt. Read the diagnosis with that in mind — the remaining fault is usually one a machine could not decide: a design question, missing credentials or cluster state, or an intent ambiguity.

## Mission

- **Dispatch on the argument** — a slice handle drives the requires-attention flow; a Spec id drives the Spec-rework flow.
- **Read the evidence, re-align to intent, verify, COMMIT.** The failure evidence (judged fault, failing output) arrives verbatim in your prompt — use it. The fix is applied in the Spec's worktree and **committed to the spec branch** (`fix(attend): <handle> <summary>`); an uncommitted fix does not exist as far as the loop is concerned.
- **Hand back:** for a slice, `move_slice → Ready`; for a Spec, tell the human to re-run Orchestrate. The next orchestration grades your committed state directly (verify-before-rework) — no worker re-authors what you fixed.
- **Route out-of-scope discoveries onto the board** and return to the fix.

## Inputs

- $ARGUMENTS: **`<id>`**, then the worktree path, then the failure evidence.
  - **Slice handle** — `TEP-{t}_SP-{n}_SL-{m}`. Selects the **requires-attention flow**.
  - **Spec id** — `SP-{t}/{n}` or `TEP-{t}_SP-{n}` (no `SL-` part). Selects the **Spec-rework flow**.
  - **The worktree path** — where the fix is applied and committed.
  - **Everything after** is the failure evidence: the judged fault and the failing output, verbatim.
  - If the id fits neither grammar, **stop and ask** rather than guessing the flow. Edge cases: **`reference.md`**.

## Procedure

1. Resolve the thinking space (precedence above).
2. **Dispatch on the argument** — slice handle → step 3; Spec id → step 4.
3. **Requires-attention flow (slice handle).**
   1. **Read the slice** with `get_slice { thinking_space, slice }` — its intent AND its `## ⚑ Requires attention` diagnosis (the judged fault + evidence). You are allowed — expected — to read everything: the evidence is how you avoid re-running the machines' failed experiments.
   2. **Fix in the worktree** named by your prompt. Follow the evidence; prefer the smallest correct change. Delegate read-only "what exists today" questions to the `explorer` subagent.
   3. **Verify at slice grain** — run the repo's verification recipe (`repo-conventions`) scoped to the slice's work, in the worktree. Green-before-handoff; no green, no hand-back.
   4. **Commit to the spec branch, in the worktree**: `git add -A && git commit -m "fix(attend): <handle> <summary>"`. Never push; the orchestrator owns publication.
   5. **Hand back:** `move_slice { thinking_space, slice, status: "Ready" }`. If the slice carries `docs: required` and you touched observable behaviour, update its doc module and pass `docs_done: true`.
4. **Spec-rework flow (Spec id).**
   1. **Read the Spec** with `get_thinkube_file { thinking_space, relative_path: "teps/TEP-{t}/SP-{n}/spec.md" }` and the delivery evidence in your prompt.
   2. **Re-align at Spec grain** in the worktree, **verify** with the repo's recipe, **commit** (`fix(attend): SP-… <summary>`).
   3. **Hand back for re-orchestration.** Orchestrate is a human board action — state that the Spec is ready for the human to re-orchestrate; never flip a slice's status as a stand-in.
5. **Sign off** (below).

### If the fault is not fixable from the worktree

Some escalations are structural: the probe needs cluster credentials, the footprint names the wrong file set, the Spec's intent is ambiguous. Do not force a code change around a board defect — fix the board record instead (`update_slice` for a footprint re-cut, `write_spec` re-certification for a probe, `patch_spec_section` for an AC), say so in the sign-off, and hand back.

### The discovery rule — keep the session bounded

Out-of-scope findings go on the board, then you return to the fix:

- a concrete unit of work under an existing Spec → `create_slice`;
- a new rationale / larger concern → `write_tep`;
- an observation, smell, or lesson → `write_retro_note`.

## Sign-off — the final block

Your **final message** ends with:

1. **Work summary** — what you re-aligned, the verification result, and the **commit** (hash + subject) that carries the fix.
2. **Board items created** — every `create_slice` / `write_tep` / retro note, by handle/path (or "none").
3. **The hand-back** — the slice is Ready (or: the Spec awaits re-orchestration); the next Orchestrate grades the committed state directly.

## Constraints

- **The fix must be committed.** An uncommitted worktree change is invisible to the loop and will not be graded. Commit to the spec branch; never push.
- **Dispatch on the argument alone.** A three-part `TEP-{t}_SP-{n}_SL-{m}` handle → attend flow (ends `move_slice → Ready`); a Spec id → rework flow (ends in a re-orchestration hand-back). Ambiguous id → ask, don't guess.
- **Bounded, never open-ended.** Out-of-scope discoveries are captured on the board and dropped; the session returns to the fix and then ends.
- **Verify before handing back** — green at the matching grain via the repo's recipe. No green = don't hand back, don't commit.
- **Capability boundary.** Orchestrate and Accept are human board actions, not tools you can call — always phrase them as hand-backs, never as self-offers.

## Output

The final message ends with the sign-off block: **work summary (incl. the fix commit) → board items created → the hand-back**. See **`reference.md`** for worked examples of both flows.

## Safety / fallback

- **kanban MCP tools absent** — STOP; you cannot read the item or hand back safely. Report the blocker; do not freehand.
- **Argument fits neither grammar** — ask which item and flow; never guess.
- **Verification can't reach green within the failure's scope** — do **not** hand back a red item, and do **not** commit a red fix. Report the state, capture the residual as a board item, and say plainly what a human must decide.
