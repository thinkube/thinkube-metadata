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
     - **Every AC must be AI-verifiable _at the gate it arms_** — the verifier checks it _before_ the step that gate guards; the human's only gate is acceptance, never executing a check. As each AC lands, ask: _"what actor and environment does verifying this need, and is that available before the gate this AC arms?"_ Reject/reframe the two anti-patterns — **human-executed** and **deploy/merge-circular**. See **`reference.md` → "AC verifiability — anti-patterns & reframes"** for the reframing rules and worked examples.
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

7. **Audit each AC's verifiability and emit the verification map.** Once the ACs and Design are settled, run an **AC-verifiability auditor** — the **opening** AI-verification gate (TEP-tgzx3p). Hand the drafted `## Acceptance Criteria` (plus the Design and the step-5 verification recipe) to an **adversarial pass via the `Task` tool** (the same delegation shape as `reviewer` / `verifier`), so each AC is interrogated with independent context. For each AC the auditor asks three questions — **actor** (must be the AI verifier), **environment** (`local` or `cluster`), and **availability before the gate it arms** — and returns `verifiable` or `needs-reframe(why)`. A `needs-reframe` AC is reworked (via `get_thinkube_file` → `write_spec`) and re-audited, and **never gets a verification entry**. When — and only when — **every** AC is `verifiable`, emit the map:

   ```
   write_spec { spec: {n}, ac_verifications: { "1": { run, env }, "2": { run, env }, … } }
   ```

   keyed by **1-based AC ordinal**, **exactly one entry per AC**, every ordinal `1..N` present. **Emitting the full map is what arms → Ready** — a Spec with any un-audited, `needs-reframe`, or undeclared AC cannot reach Ready (the gate blocks and names the ordinal). **Re-run this whole step whenever the ACs change.** See **`reference.md` → "The AC-verifiability auditor"** for the full verdict mechanics, the `{ run, env }` derivation, and the both-ends serialization contract.

8. **Report — do NOT commit.** The `board-autosave` Stop hook commits + pushes the board sidecar at turn end; it owns board bookkeeping, so a manual `git commit` is redundant (and was only ever needed while the hook was unwired). Just print the path, AC count, the verification-map count (one entry per AC), and the suggested next step (`/slice {n}`).

## Constraints

- The four section headers (`## Acceptance Criteria`, `## Constraints`, `## Design`, `## File Structure Plan`) are **load-bearing** — the quality gates and the staleness hash look for these exact strings. Don't rename them.
- **Acceptance criteria are outcome-level, not implementation steps**, must be **AI-verifiable at the gate they arm** (no human-executed or deploy/merge-circular ACs), and each must trace to something the user agreed to — don't invent criteria.
- **Every AC carries a certified `ac_verifications` entry before Ready** (TEP-tgzx3p), emitted only through `write_spec` (one serialization, both ends) — don't hand-craft the frontmatter or emit a partial map.
- The full constraint list — reframing rules, the auditor contract, and the both-ends serialization invariant — lives in **`reference.md` → "Constraints (full)"**.

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
- **An AC the auditor can't certify** stays out of the map — move its intent to a Design/Constraints note or a non-gating follow-up and drop the `- [ ]` line.
- **`write_spec` / `get_thinkube_file` absent in this session.** STOP and say so — do **not** fall back to a raw `Write`/`Edit`, which would write the Spec outside the board (into the code repo). Fix: start a fresh session in the repo so `.mcp.json` loads the kanban server.

See **`reference.md` → "Safety / fallback (full)"** for the complete playbook, including the existing-spec-with-user-edits re-fetch protocol.
