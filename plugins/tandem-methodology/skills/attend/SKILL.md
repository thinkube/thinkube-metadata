---
description: Run the human fix session for a requires-attention slice or a rejected-Spec rework — state the disposable-worktree lifecycle contract, re-align behaviour to the slice/Spec intent, verify, and hand back to the loop. MUST BE USED when a session is opened via /attend with a slice handle or a Spec id and an intent-framed divergence.
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
    "mcp__thinkube-kanban__create_slice",
    "mcp__thinkube-kanban__write_tep",
    "mcp__thinkube-kanban__write_retro_note",
    "mcp__thinkube-kanban__resolve_project_space",
    "mcp__thinkube-kanban__list_thinking_spaces",
    "Task",
  ]
argument-hint: "<slice-handle | spec-id> <intent-framed divergence…>"
thinkube-bundle: 0.0.1
---

# /attend

Run the **human fix session** for one board item that the orchestrator could not close on its own: either a **slice in `Requires-attention`** (a worker hit something it couldn't resolve) or a **Spec that was rejected at review** and needs rework. The session re-aligns the code to the item's **intent**, verifies at the matching grain, and hands the item back to the board loop — then it **ends**.

This session runs inside a **disposable orchestration worktree**. That worktree is deleted the moment the Spec's orchestration is **accepted**, and this conversation — its cwd, its history, its ability to run anything — dies with it. So the skill's job is bounded and its first and last moves are both about the lifecycle: state the contract before diagnosing, and hand off with the close-this-session instruction before anyone re-orchestrates or accepts.

> **Determining the thinking space — derive, don't guess.** Every kanban call below (`get_slice`, `get_thinkube_file`, `move_slice`, …) takes `thinking_space=<id>` — there is no cwd default. Precedence, stopping at the first that resolves: **(1)** an explicit `thinking_space` in the args wins; **(2)** else call `resolve_project_space { cwd: <session root> }` and use the returned `namespace` if non-null; **(3)** else **ask the user** which thinking space before any read. Never hand-match cwd against paths.

> **This session is confined to the intent-framed divergence in the args.** The extension (or the human) hands you *what diverged from intent*, in the human's words. That framing **is** your whole scope. See **Constraints → Anti-gaming boundary** — you do **not** go fishing on the board or in `DELIVERY.md` for the AC ordinals, the failing run commands, or their raw output. Re-align to intent; verify with the repo's own recipe.

## Mission

Take a stranded board item back to a runnable state, bounded by the divergence you were handed:

- **Open with the lifecycle contract** (below) — before any diagnosis.
- **Dispatch on the argument** — a slice handle drives the requires-attention flow; a Spec id drives the Spec-rework flow.
- **Re-align to intent → verify → hand back to the loop.** For a slice: `move_slice` → `Ready`. For a Spec: hand back for re-orchestration.
- **Route every out-of-scope discovery onto the board** and return to the fix — never drift into open-ended continuation.
- **Sign off with the mandated close-this-session block.**

## Inputs

- `$ARGUMENTS`: **`<id> <divergence text…>`**.
  - **Slice handle** — `TEP-{t}_SP-{n}_SL-{m}` (the full three-part handle). Selects the **requires-attention flow**. (`move_slice` addresses it by its `SP-{n}_SL-{m}` handle.)
  - **Spec id** — `SP-{t}/{n}` or `TEP-{t}_SP-{n}` (no `SL-` part). Selects the **Spec-rework flow**.
  - **Everything after the id** is the **intent-framed divergence**: the human's description of how behaviour departed from what the slice/Spec meant to deliver. This is the scope of the whole session.
  - If the id fits neither grammar, **stop and ask** rather than guessing the flow. Edge cases and worked examples: **`reference.md`**.

## The lifecycle contract — your opening move

**Before any diagnosis, the very first response states the contract**, in plain terms:

> This session is rooted in a **disposable orchestration worktree**. That worktree is **deleted when this Spec's orchestration is accepted** — and this conversation cannot survive that deletion (its working directory disappears out from under it). So: we fix the divergence here, hand the item back to the board, and then **you close this session before re-running Orchestrate or Accepting**. Nothing we do here is durable except what lands on the board.

Only after stating this do you read the item and begin. (The cwd-fallback wrapper and the `stale-cwd-warn` SessionStart hook are safety nets for a human who forgets — they are not a substitute for the clean handoff.)

## Procedure

1. **State the lifecycle contract** (above). Resolve the thinking space (precedence in the note above).
2. **Dispatch on the argument** — slice handle → step 3 (attend); Spec id → step 4 (rework).
3. **Requires-attention flow (slice handle).**
   1. **Read the slice's intent** with `get_slice { thinking_space, slice: SP-{n}_SL-{m} }` — the `# title` and detail body, i.e. *what capability this slice was meant to deliver*. Read only the intent; **do not** pull the slice's `satisfies` ordinals, its `ac_verifications` run commands, or `DELIVERY.md` failing evidence (Anti-gaming boundary).
   2. **Bring behaviour back in line with that intent**, guided only by the intent-framed divergence in your args. Edit within the code; delegate a read-only "what exists today" question to the `explorer` subagent to keep context lean.
   3. **Verify at slice grain** — run the repo's own verification recipe (`repo-conventions`) scoped to the slice's work. Green-before-handoff is the invariant; no green, no hand-back.
   4. **Hand back to the loop:** `move_slice { thinking_space, slice: SP-{n}_SL-{m}, status: "Ready" }`. If the slice carries a `docs: required` obligation and you touched observable behaviour, update its doc module and pass `docs_done: true`.
4. **Spec-rework flow (Spec id).**
   1. **Read the Spec's intent** with `get_thinkube_file { thinking_space, relative_path: "teps/TEP-{t}/SP-{n}/spec.md" }` — the Goal / Design / Acceptance Criteria as *intent*, not as a checklist to fish evidence from.
   2. **Re-align at Spec grain** — bring the implementation back in line with the Spec's intent, bounded by the divergence in your args.
   3. **Verify** with the repo's recipe at whatever grain the rework touched.
   4. **Hand back for re-orchestration.** A Spec's advance is the **Orchestrate board command (SP-tgs8nz), not a tool you can call** — so this is a **handoff**, not a self-offer: state that the Spec is ready for the human to re-orchestrate. Do **not** flip a slice's status as a stand-in for running Orchestrate.
5. **Sign off** with the mandated block (below). This is the last thing you do.

### The discovery rule — keep the session bounded

While fixing, you will notice other things. Classify each against **the divergence you were handed**:

- **In scope of the divergence** → fix it here.
- **Out of scope** → **capture it on the board and return to the fix.** Never follow it — an out-of-scope thread is not this session's work, and this session has a hard end.
  - A concrete unit of work under an existing Spec → `create_slice` (a new slice at `status: ready`).
  - A new rationale / larger concern → `write_tep`.
  - An observation, smell, or lesson → `write_retro_note`.

Capturing it on the board is what makes dropping it safe: the board survives this worktree; your memory of it does not.

## Sign-off — the mandated final block

Your **final message** ends with this block, in this order:

1. **Work summary** — what you re-aligned and the verification result (pass/fail at the grain you ran).
2. **Board items created** — every `create_slice` / `write_tep` / retro note from the discovery rule, by handle/path (or "none").
3. **The close-this-session instruction**, stated as a handoff and restating the reason:

> **Close this session now, before you re-run Orchestrate or Accept.** This worktree is deleted on accept and this conversation dies with it — re-orchestrating or accepting with this session still open is exactly the stranded-session failure. The board carries everything durable from here; nothing else needs this conversation alive.

The message must not end on an open-ended offer to keep working — the item is back on the board and the next move is the human's, in a fresh session.

## Constraints

- **The lifecycle contract is the opening move** — state it before reading the item or diagnosing anything. The close-this-session instruction is the closing move — it is the last thing in the final message.
- **Dispatch on the argument alone.** A three-part `TEP-{t}_SP-{n}_SL-{m}` handle → attend flow (ends in `move_slice` → `Ready`); a Spec id (`SP-{t}/{n}` or `TEP-{t}_SP-{n}`, no `SL-`) → rework flow (ends in a re-orchestration handoff). Ambiguous id → ask, don't guess.
- **Anti-gaming boundary — confine to the intent-framed divergence.** Your scope is the divergence text in the args. You must **never** retrieve, read, or reconstruct: the slice's/Spec's **AC ordinals**, the **`ac_verifications` run commands**, their **raw failing output**, or the failing-check evidence in **`DELIVERY.md`**. The board's redaction strips that evidence deliberately; re-aligning to intent and verifying with the repo's own recipe does not need it, and fishing for it defeats the boundary. If a tool denial points you at the divergence framing, that is the source — use it.
- **Bounded, never open-ended.** Out-of-scope discoveries are captured on the board and dropped; the session returns to the fix and then ends. No "while I'm here" continuation.
- **Verify before handing back** — green at the matching grain via the repo's recipe. No green = don't hand back.
- **Capability boundary.** Orchestrate and Accept are **human board actions**, not tools you can call — always phrase them as handoffs, never as self-offers, and never flip a status label as a stand-in for them.
- **Safety nets untouched.** This skill does not modify `hooks/hooks.json`, `stale-cwd-warn.mjs`, or the cwd wrapper — they remain the fallback for a human who forgets to close.

## Output

The final message ends with the sign-off block: **work summary → board items created → close-this-session instruction** (restating that the worktree dies on accept). See **Sign-off** above for the exact wording; **`reference.md`** for worked examples of both flows.

## Safety / fallback

- **kanban MCP tools absent** — STOP; you cannot read the intent or hand back safely. Report the blocker; do not freehand.
- **Argument fits neither grammar** — ask which item and flow; never guess.
- **Verification can't reach green within the divergence's scope** — do **not** hand back a red item. Report the state, capture the residual as a board item, and still deliver the close-this-session sign-off (the worktree's lifecycle is unchanged by a red result).
