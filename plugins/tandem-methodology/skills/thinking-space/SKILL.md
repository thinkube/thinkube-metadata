---
description: Surface the current thinking space state in chat (read-only snapshot). Tells the user how to open the interactive panel.
allowed-tools: ["mcp__thinkube-kanban__list_thinking_space"]
argument-hint: "(no args)"
thinkube-bundle: 0.0.1
---

# /thinking-space

Show a text snapshot of the current thinking space: slices grouped by column, read straight from slice frontmatter. Use this for a quick read on what's in flight without leaving the chat. For the interactive thinking space (drag-and-drop, card detail), tell the user to open the VS Code panel.

> **The thinking space must be provided explicitly.** If the invocation doesn't specify which thinking space, **ASK the user which thinking space to use** — never infer it from the working directory (there is no cwd default). Pass that id as `thinking_space=<id>` on every call below.

## Mission

A compact chat-readable view of the project's current state, plus a pointer to the interactive panel.

## Procedure

1. **Snapshot.** Call `mcp__thinkube-kanban__list_thinking_space thinking_space=<id>`. It returns cards grouped into **Ready / Doing / Done** (read from each slice's `status:` frontmatter); each card carries its handle (`id`, e.g. `SP-3_SL-42`), `title`, `specStale`, and `specChange`.
2. **Format.** Render as a table with one column per status (**Ready, Doing, Done** — three columns, in that order). Each cell lists `SP-{n}_SL-{m} <title>` rows. Truncate titles past ~50 chars.
3. **Highlight staleness.** Flag any **done** card with `specChange: "requirements"` — its parent Spec's requirement sections changed since it was verified, so it needs re-verification (the orchestrated run's staleness sweep). Ignore `metadata`-only staleness.
4. **Point at the interactive panel.** Tell the user: Activity Bar → **Thinkube** → **Thinking Spaces** → click this repo to open its thinking space (or Command Palette → **Thinkube Kanban: Open Kanban** for the configured root).

## Constraints

- Read-only. Don't move cards here — that's `move_slice` (driven by the gates) and direct UI manipulation.
- Don't dump the full JSON. Format for human eyes.
- **Write for a global audience (plain English).** Human-facing text uses short sentences and common words. The first time a methodology term appears, gloss it in the pattern "footprint (the list of files a task may edit)" — leave no jargon bare, and use no idioms that do not translate across languages.

## Output

```
📋 Thinking Space: <owner/repo>

   Ready              Doing             Done
   SP-3_SL-4 Wire     SP-3_SL-3 Stripe  SP-3_SL-1 Old
   SP-3_SL-5 Cache    …                 SP-3_SL-2 Diff ⚠ stale
   (4)                (1)               (12)

▶ Open the interactive thinking space: Activity Bar → Thinkube → Thinking Spaces → click this repo.
```

## Safety / fallback

- **Thinking space not specified.** If the invocation doesn't name a thinking space, ask the user which one to use before calling `list_thinking_space` — never infer it from the working directory.
- **No thinking space at that id.** A Space is methodology-enabled only if its namespace dir exists in the sidecar thinking-space repo (via `thinkube.thinkingSpace.root`). If `list_thinking_space` returns nothing, tell the user this Space isn't methodology-enabled yet (author a Spec via `/spec-prepare`, then `/slice`).
- **MCP error.** Surface the underlying error verbatim.
