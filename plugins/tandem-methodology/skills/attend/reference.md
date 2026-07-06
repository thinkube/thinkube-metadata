# /attend — reference

Overflow detail for the `/attend` skill. Load on demand; the always-loaded body is `SKILL.md`.

## Argument grammar — edge cases

The dispatch is purely lexical on the **id token** (the first whitespace-delimited token of `$ARGUMENTS`); everything after it is the intent-framed divergence text, passed through verbatim as scope.

| id token shape | flow | notes |
| --- | --- | --- |
| `TEP-{t}_SP-{n}_SL-{m}` | **requires-attention** (slice) | full three-part handle; `move_slice` addresses the slice by its `SP-{n}_SL-{m}` sub-handle |
| `SP-{t}/{n}` | **Spec rework** | composite `<tep>/<sp>` form |
| `TEP-{t}_SP-{n}` | **Spec rework** | underscore form of the same Spec id — **no `SL-` part** |
| anything else | — | **stop and ask** which item + flow; never infer |

Disambiguation rule: **a `SL-` segment means slice-attend; its absence means Spec-rework.** A bare `SP-{n}` with no TEP is ambiguous across TEPs (the same `SP-{n}` can exist under several TEPs) — ask for the composite `<tep>/<sp>` rather than guessing.

The divergence text can be empty (a human invoking by hand may pass only the id). Treat an empty divergence as "no framing supplied" — read the item's intent, and if the misalignment isn't self-evident, **ask the human** what diverged rather than inventing a divergence or fishing the board for failing evidence (that would breach the anti-gaming boundary).

## Worked example — requires-attention (slice)

Invocation: `/attend TEP-11_SP-1_SL-3 the retry wrapper swallows the timeout instead of surfacing it`

1. **Contract first.** State the disposable-worktree lifecycle contract (deleted on accept; this conversation dies with it).
2. **Read intent.** `get_slice { thinking_space, slice: "SP-1_SL-3" }` → the slice was meant to *surface* transport errors to the caller. (Read title + body only — not `satisfies`, not `ac_verifications`, not `DELIVERY.md`.)
3. **Re-align.** Edit the wrapper so the timeout propagates, guided by the divergence text.
4. **Verify at slice grain** via the repo's recipe (`repo-conventions`).
5. **Discovery, out of scope:** you notice the logger double-formats messages elsewhere → `create_slice` under the appropriate Spec, then **return to the fix**.
6. **Hand back:** `move_slice { thinking_space, slice: "SP-1_SL-3", status: "Ready" }` (+ `docs_done: true` if it carried `docs: required` and behaviour changed).
7. **Sign off:** work summary → board items created (the new slice) → close-this-session instruction.

## Worked example — Spec rework (rejected Spec)

Invocation: `/attend SP-11/1 the skill never states the worktree is deleted on accept`

1. **Contract first** (same opening).
2. **Read intent.** `get_thinkube_file { thinking_space, relative_path: "teps/TEP-11/SP-1/spec.md" }` — Goal/Design as intent.
3. **Re-align at Spec grain** — bring the implementation back to the Spec's intent, bounded by the divergence.
4. **Verify** with the repo's recipe at the touched grain.
5. **Hand back for re-orchestration** — a **handoff** ("this Spec is ready for you to re-run Orchestrate"), never a self-offer, never a status-flip stand-in.
6. **Sign off** with the mandated block.

## Why the boundary is hard, not advisory

The board's redaction exists so a fix session can't be steered by the *letter of the failing check* — which is how a re-align session games its way to green without actually restoring intent. `/attend` re-aligns to **intent** (the slice/Spec body + the human's divergence framing) and re-verifies with the **repo's own recipe**, which needs none of the stripped evidence. Reaching for the AC ordinals, the `ac_verifications` commands, their raw output, or `DELIVERY.md` failing evidence is therefore always out of bounds — not because it's unavailable, but because using it is the failure mode the boundary prevents.

## What this skill deliberately does not touch

Per the Spec's constraints, the stranded-session safety nets stay as-is: `hooks/hooks.json`, `stale-cwd-warn.mjs` (the SessionStart stale-cwd warning), and the cwd-fallback wrapper. They protect a human who forgets to close; `/attend`'s clean sign-off is the primary path, they are the backstop.
