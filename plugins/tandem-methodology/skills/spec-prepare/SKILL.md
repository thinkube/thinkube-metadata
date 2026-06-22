---
description: Prepare/fill a Spec body to the Tandem shape (acceptance criteria, constraints, design, file plan) at specs/SP-{n}/spec.md. MUST BE USED when the user says "create a spec", "write a spec", "prepare a spec", "spec for TEP-X", or asks to turn a TEP into a spec. Do not hand-author spec files yourself.
allowed-tools:
  [
    "Read",
    "Grep",
    "Glob",
    "mcp__thinkube-kanban__get_thinkube_file",
    "mcp__thinkube-kanban__write_spec",
    "Task",
  ]
argument-hint: "<spec-number>"
thinkube-bundle: 0.0.1
---

# /spec-prepare

Fill in a Spec's body to the standard Tandem shape. The Spec lives as a committed file at `specs/SP-{n}/spec.md` **in the board** (the central sidecar namespace, TEP-0008) — the single source of truth. Read it with `get_thinkube_file` and write it with `write_spec`; **both are board-aware**, so the file always lands in the sidecar regardless of where the session is rooted. Never write the Spec with a raw `Write`/`Edit` — a relative path resolves against the session's cwd (the code repo), not the board. After this skill runs, the → Ready gate passes — every AC is certified `verifiable` by the auditor and carries an `ac_verifications` entry (not merely a non-empty `## Acceptance Criteria`) — and the Spec is ready for `/slice`.

> **Decision-point protocol** (methodology `CLAUDE.md`): this is _human-paced_ authoring — converse → options → research → **read-back** → the human's explicit **"go."** Surface options as prose, never force convergence, and **approve ≠ execute**.

## Mission

Produce a fully-shaped `specs/SP-{n}/spec.md` containing the four canonical sections, with:

- **Acceptance criteria** that the → Ready gate will accept (non-empty checklist) and that are **user-observable / verifiable**.
- A **verification map** (`ac_verifications`) — exactly one runnable `{ run, env }` per AC, certified by the verifiability auditor — emitted before → Ready so the **closing** AI-verification gate (SP-tgzyfy / TEP-tgzx3p) has something to run.
- **Constraints** that bound the design (perf, compat, security, deadlines).
- **Design** at the depth needed to start slicing, not a full implementation guide.
- **File plan** naming the files the spec will touch.

## Inputs

- `$ARGUMENTS`: the Spec id `{n}` — an opaque string (base36-epoch for new Specs, a legacy integer for old ones).

## Context discipline

Gather the minimum, in the right order, and only after the governing document exists:

- **The shapes embedded in this skill are authoritative and complete.** The skeleton (step 3) and the target shape (step 6) _are_ the canonical Spec format — **never read other specs or slice files to learn the format.** Reading neighbours "for the format" is wasted context and copies their drift.
- **No uninstructed reads.** Don't call `list_board` or other "just in case" tools the task didn't ask for. Fetch the one spec file you're filling — nothing else up front.
- **`CLAUDE.md` before any codebase search.** Architecture questions are usually answered by `CLAUDE.md` and the docs; consult them first, and search the code only for what the docs don't answer.
- **Explore only _after_ — and _scoped by_ — the acceptance criteria.** Codebase exploration grounds the _Design_, so it cannot precede the AC that bound it. Delegate genuine "what's in this codebase" questions to the `explorer` subagent to keep the main context lean.
- **The bar: lead with the interview.** Two setup actions accompany the opening — fetching `specs/SP-{n}/spec.md` via `get_thinkube_file` (step 2) and scaffolding via `write_spec` (step 3) — but the first turn to the user is a question, not a "go read the file" handoff. No other reads up front.

## Procedure

1. **Read methodology context** if not in session.
2. **Fetch the spec file.** Use `get_thinkube_file specs/SP-{n}/spec.md`; if the file is non-empty, treat it as a draft to refine rather than rewriting from scratch. _(Action 1 — the only read before the skeleton.)_
3. **Open with the interview, scaffold alongside.** The conversation leads — ask the user for the spec's acceptance criteria as the first turn. Scaffold the file in parallel: `write_spec { spec: {n}, body }` with the exact shape of step 6 and placeholder bodies (`_(under discussion — see chat)_`). Mention the path once and, if the user wants a rendered view alongside the chat, point them at the Command Palette (_Markdown: Open Preview to the Side_) — optional, and never quote a keybinding (they don't fire reliably in browser / code-server).
4. **Interview the user, section by section.** Ask in chat and land every agreed draft into the FILE — chat and the file are both fine to review in; the file is just the durable record. `write_spec` replaces the whole body, so each update is **read-modify-write**: `get_thinkube_file specs/SP-{n}/spec.md` to fetch the current body, apply your change, then `write_spec` the full body back. The user may edit the file directly at any time and their edits are authoritative: **always re-fetch with `get_thinkube_file` immediately before each `write_spec`** and never clobber text you didn't write. **Acceptance criteria come first** — they scope the exploration in step 5.
   - **Acceptance criteria**: elicited **from the user** — there is no parent Story to inherit them from. They must be **user-observable outcomes**, framed so they can be verified, not implementation steps. Good: "A new user receives an email within 30s of submitting the form." / "Endpoint returns 401 when the token is expired and the body matches `{error: 'expired_token'}`." Bad: "Add a Redis session store" (that's work, it belongs in a slice).
     - **Every AC must be AI-verifiable _at the gate it arms_** — i.e. the verifier can check it _before_ the step that gate guards (Done before merge; acceptance before merge). The human's only gate is acceptance (judging the assembled result), never executing a check. As each AC lands, ask: _"what actor and environment does verifying this need, and is that available before the gate this AC arms?"_ Reject/reframe two anti-patterns:
       - **Human-executed** — "manual verify in a fresh session," "the human checks," "you confirm that…". Reframe: for a probabilistic/heuristic outcome, gate its **controllable proxy** plus an **AI-run probe** (e.g. for LLM routing: "the description carries the proven trigger shape" + an AI discrimination pass over positive/negative cases). If it genuinely can't be AI-verified, it's a **Design/Constraints note**, not an AC.
       - **Deploy/merge-circular** — "after deploying…," "once merged, the live/production endpoint…" — verifiable only by performing the merge/deploy the AC is supposed to authorize (the loop is verify → Done → accept → merge → deploy, so this deadlocks). Reframe into (a) a **pre-merge-verifiable** AC checked in a local run / ephemeral PR-preview / staging environment, **plus** (b) a **post-deploy smoke check** recorded as a follow-up obligation or a follow-up slice — _never_ a Done-blocking AC. Do not reorder the loop to deploy before acceptance.
       - Example — Bad (human-executed): "In a fresh session, confirm the new prompt routes correctly." → Good (AI-verifiable): "Given the new prompt, a routing-discrimination pass routes 5/5 positive utterances to the skill and 0/4 negatives — checked by the verifier." Bad (deploy-circular): "After deploying, GET /health returns 200." → Good: "GET /health returns 200 against the PR-preview/staging deploy (Done-gating); production /health 200 is a post-deploy smoke check, not a Done condition."
   - **Constraints**: list. Performance budgets, browser support, dependency rules, deadlines.
   - **Design**: 1–3 paragraphs. Approach + key data structures + integration seams. Not pseudocode. This is also where **spikes / investigations** ("confirm X behaves like Y") land — they are not slices.
   - **File structure plan**: bullet list of files we expect to create / modify, one line of why each.
   - **Documentation impact** (TEP-tgh6iy): as the ACs land, note which are **user-facing** — anything a reader can observe (a feature, CLI, API, config surface, install/upgrade step, or template behavior). That impact seeds each slice's `docs:` obligation in `/slice` (user-facing → `docs: required`; internal-only → `docs: n/a` + reason), so the → Done docs gate has something concrete to check. Record it in the Design (e.g. "the X page documents this") rather than as its own section.
5. **Explore the codebase — only now, scoped by the agreed AC.** With the acceptance criteria settled, ground the Design against reality: consult `CLAUDE.md` first, then delegate "what's currently in this codebase" questions to the `explorer` subagent (`Task` tool), or use Grep/Glob for a targeted check. Explore only what the docs don't already answer and only what the AC require — then fold what you learn into the Design / File Structure Plan in the file. **Note the repo's verification recipe** (test / lint / typecheck commands per `repo-conventions`) — step 7 needs it to write each AC's concrete `run` command.
6. **Target shape.** The file must converge to exactly this structure (the skeleton from step 3 already has it; sections fill in as agreement lands):

```
# {title}

{one-paragraph summary}

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] …

## Constraints

- <constraint 1>
- <constraint 2>

## Design

<approach + structures + seams>

## File Structure Plan

- `path/to/file.ts` — <reason>
- `other/file.tsx` — <reason>
```

7. **Audit each AC's verifiability and emit the verification map.** Once the ACs and Design are settled, run an **AC-verifiability auditor** — the **opening** AI-verification gate (TEP-tgzx3p), the authoring-time mirror of the closing gate SP-tgzyfy shipped. A Spec reaches **Ready only when every AC is certified `verifiable` and carries a runnable `ac_verifications` entry.** **Reuse the methodology's adversarial-subagent pattern** — the same delegation shape as `reviewer` / `verifier`: hand the drafted `## Acceptance Criteria` (plus the Design and the step-5 verification recipe) to an adversarial pass via the `Task` tool, so each AC is interrogated with **independent context**, not waved through by the author who just wrote it. For **each** AC the auditor asks the three questions:
   - **Actor** — who runs the check? It must be the **AI verifier**, never a human.
   - **Environment** — where does it run: `local` (the repo / a shell) or `cluster` (an infra lifecycle)?
   - **Availability before the gate it arms** — is that actor + environment available _before_ the step this AC guards (Done before merge; acceptance before merge)?

   The auditor returns, per AC, a verdict — `verifiable` or `needs-reframe(why)`:
   - **`needs-reframe`** — the AC is **human-executed** or **deploy/merge-circular** (the step-4 anti-patterns), so no AI actor + environment can check it before its gate. **Rework or drop it before emitting the map** — reframe per step 4 (probabilistic → controllable proxy + AI probe; deploy-circular → pre-merge/preview AC + a non-gating post-deploy smoke check), land the new wording with a `get_thinkube_file` → `write_spec` read-modify-write, then **re-audit**. A `needs-reframe` AC **never gets a verification entry** — so a partial map can't sneak it past the gate.
   - **`verifiable`** — produce a concrete **`{ run, env }`**: `run` is the shell / playbook command that checks _this_ AC (exit 0 = pass), grounded in the repo's verification recipe (the codebase facts gathered in step 5); `env` is `local` (repo / shell) or `cluster` (an infra lifecycle).

   When — and only when — **every** AC is `verifiable`, emit the map:

   ```
   write_spec { spec: {n}, ac_verifications: { "1": { run, env }, "2": { run, env }, … } }
   ```

   keyed by **1-based AC ordinal**, **exactly one entry per AC**, every ordinal `1..N` present (no orphan / missing keys). `write_spec` normalizes and serializes it to the Spec's `ac_verifications:` frontmatter; this is the per-AC declaration the **closing** gate (SP-tgzyfy / TEP-tgzx3p) runs as a single plan at Spec quiescence and gates Done / commit on all-green. **Emitting the full map is what arms → Ready.** A Spec with any un-audited, `needs-reframe`, or undeclared AC **cannot reach Ready** — the → Ready gate (`createSlice`'s `readyGate`) blocks and names the offending ordinal, so don't skip this step or emit a partial map. **Re-run this whole step whenever the ACs change** (and `/slice` re-checks it when it touches ACs).

8. **Commit, then report.** Commit **and push** the spec file to the board and report the commit — don't ask first (board bookkeeping, per CLAUDE.md). Then print the path, AC count, the verification-map count (one entry per AC), and the suggested next step (`/slice {n}`).

## Constraints

- The four section headers (`## Acceptance Criteria`, `## Constraints`, `## Design`, `## File Structure Plan`) are **load-bearing** — the quality gates and the staleness hash look for these exact strings. Don't rename them.
- **Acceptance criteria are outcome-level, not implementation steps.** Each `- [ ]` line is something the user can observe or a verifier can check. Implementation work lives in slices, not here.
- **Acceptance criteria must be AI-verifiable at the gate they arm.** No human-executed ACs ("the human checks in a fresh session") and no deploy/merge-circular ACs (verifiable only after the merge/deploy the AC gates) — both stall the loop. Reframe per step 4: probabilistic → controllable proxy + AI probe; deploy-circular → pre-merge/preview-verifiable AC + a non-gating post-deploy smoke check; otherwise → a Design/Constraints note. The human's only gate is acceptance.
- **Every AC carries a certified `ac_verifications` entry before Ready** (TEP-tgzx3p / closes the SP-tgqf1v gap). The verifiability auditor (Procedure step 7) certifies each AC `verifiable` via an independent adversarial subagent pass and emits a runnable `{ run, env }` per ordinal through `write_spec`; a `needs-reframe` AC is reworked or dropped, **never declared**. The → Ready gate (`createSlice`'s `readyGate`) blocks any Spec with an un-audited or undeclared AC and names the ordinal — don't hand-craft the frontmatter and don't emit a partial map.
- **One serialization, both ends.** Emit the map only through `write_spec` (which normalizes it to canonical `{ run, env }` frontmatter); the closing gate reads the same frontmatter. Don't invent a second declaration shape — the round-trip holds by construction.
- Don't invent acceptance criteria the user didn't agree to. Each `- [ ]` line should trace to something the user explicitly said or confirmed.

## Output

```
✅ SP-{n}: <title>
   spec:    specs/SP-{n}/spec.md
   ac:      <count> acceptance criteria
   verify:  <count> ac_verifications (1 per AC, all certified verifiable)
   files:   <count> in file plan
   next:    /slice {n}
```

## Safety / fallback

- **No acceptance criteria the user will commit to.** Refuse to write — at least one user-observable criterion is required, or the → Ready gate will block the Spec's slices from advancing.
- **An AC the auditor can't certify.** If an AC stays `needs-reframe` after a rework attempt — no AI actor + environment can verify it before its gate — it is **not an AC**: move its intent to a Design/Constraints note or a non-gating follow-up obligation, then drop the `- [ ]` line. Never emit an `ac_verifications` entry for it, and never leave it undeclared "for now" — the → Ready gate will block the whole Spec on it.
- **Existing spec with user edits.** Re-fetch with `get_thinkube_file` first; preserve sections the user has filled out. `write_spec` rewrites the whole body, so only re-emit sections the user has agreed to update during this run — keep the rest verbatim. Re-run the step-7 audit when the ACs changed.
- **`write_spec` / `get_thinkube_file` absent in this session.** STOP and say so — do **not** fall back to a raw `Write`/`Edit`, which would write the Spec outside the board (into the code repo). Fix: start a fresh session in the repo so `.mcp.json` loads the kanban server.
