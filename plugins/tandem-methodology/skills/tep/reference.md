# /tep — reference

Rarely-needed detail for the `/tep` skill, split out of `SKILL.md` to keep the always-loaded
instructions lean. Load this on demand when you need the read-modify-write mechanics, the exact
output shape, the fallback behaviour, or the rationale behind the context-discipline rules.

## Read-modify-write mechanics

The TEP body is authored incrementally as the conversation lands each section, but `write_tep`
**replaces the whole body** — so every update is a **read-modify-write** cycle:

1. `get_thinkube_file { thinking_space: <id>, path: "teps/TEP-{id}/tep.md" }` to fetch the current body.
2. Apply your change to that fetched text.
3. `write_tep { thinking_space: <id>, tep: {id}, body }` the **full** body back.

Always re-fetch immediately before each `write_tep`; **never clobber text you didn't write**. Set
the title via `write_tep { thinking_space: <id>, tep, title }`.

Scaffolding: call `write_tep { thinking_space: <id>, tep: {id} }` with no body first to lay down the `TEP-TEMPLATE.md`
skeleton + canonical frontmatter. Mention the path once — `teps/TEP-{id}/tep.md`. If the user wants a
rendered view alongside the chat, point them at the Command Palette (_Markdown: Open Preview to the
Side_); it's optional, and **never quote a keybinding** (they don't fire reliably in browser /
code-server). Chat and the file are both fine to review in — the file is just the durable record.

## Context discipline (rationale)

- **The template is authoritative.** `TEP-TEMPLATE.md` is the single source of the shape —
  `write_tep` scaffolds from it. **Never read other TEPs to learn the format**; reading neighbours
  copies their drift.
- **No plan mode.** Do **not** enter plan mode — it blocks in-file authoring. Structured
  `AskUserQuestion` pickers work in normal mode and compose with write-skeleton-then-fill. A skill
  self-entering plan mode would override its own guardrails.
- **No uninstructed reads.** Fetch the one TEP you're filling — nothing else up front. `CLAUDE.md`
  before any codebase search; delegate genuine "what's in this codebase" to the `explorer`
  subagent.

## Sizing implementing specs

Default to **one spec per working repo** — the spec is the merge boundary, so one spec is one merge. Splitting a TEP into more specs multiplies the merges, the acceptance gates, and the coordination between them, and buys nothing unless a real boundary forces the split. Three boundaries force it:

- **A different repo** — code that lands in a separate working repo is a separate merge, so a separate spec.
- **A genuinely independent landing** — a piece that can ship on its own, with its own acceptance, and does not wait on the rest.
- **A different verification actor** — the result is checked by a different actor or environment than the rest of the work.

If none of these hold, keep it one spec. When you do list several candidate seams as separate specs, write down why each one cannot fold into the others — that sentence is the test, and if you cannot write it, the seams are one spec.

## Output

```
✅ TEP-{id}: <title>
   tep:    teps/TEP-{id}/tep.md
   status: proposed
   next:   /spec-prepare to cut an implementing spec (set implements: TEP-{id})
```

## Safety / fallback

- **No acceptance the user will commit to.** A TEP can sit `proposed` — don't force `accepted`.
- **`write_tep` / `get_thinkube_file` absent in this session.** STOP and say so — do **not** fall
  back to a raw `Write`/`Edit`, which would write the TEP outside the thinking space. Fix: start a fresh
  session in the repo so `.mcp.json` loads the kanban server.
