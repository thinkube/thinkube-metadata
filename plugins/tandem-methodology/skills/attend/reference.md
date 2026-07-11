# /attend — reference

Overflow detail for the `/attend` skill. Load on demand; the always-loaded body is `SKILL.md`.

## Argument grammar — edge cases

The dispatch is purely lexical on the **id token** (the first whitespace-delimited token of `$ARGUMENTS`); everything after it is the worktree note plus the failure evidence, passed through verbatim.

| id token shape | flow | notes |
| --- | --- | --- |
| `TEP-{t}_SP-{n}_SL-{m}` | **requires-attention** (slice) | full three-part handle |
| `SP-{t}/{n}` | **Spec rework** | composite `<tep>/<sp>` form |
| `TEP-{t}_SP-{n}` | **Spec rework** | underscore form of the same Spec id — **no `SL-` part** |
| anything else | — | **stop and ask** which item + flow; never infer |

Disambiguation rule: **a `SL-` segment means slice-attend; its absence means Spec-rework.** A bare `SP-{n}` with no TEP is ambiguous across TEPs (the same `SP-{n}` can exist under several TEPs) — ask for the composite `<tep>/<sp>` rather than guessing.

The evidence text can be empty (a human invoking by hand may pass only the id). Then read the item's own `## ⚑ Requires attention` diagnosis via `get_slice` — it carries the judged fault and the failing output. If there is no diagnosis either, **ask the human** what diverged.

## Worked example — requires-attention (slice)

Invocation (as the board primes it):

```
/attend TEP-11_SP-1_SL-3

The Spec's worktree — apply the fix THERE and commit it to the spec branch before handing back: /home/u/repo-worktrees/TEP-11_SP-1

Closing gate: AC #2 (verification red) did not pass. Judged fault: code — the retry wrapper swallows the timeout instead of surfacing it.
$ node --test out-test/retry.test.js → exit 1 …
```

1. **Read the slice.** `get_slice { thinking_space, slice: "TEP-11_SP-1_SL-3" }` — intent + full diagnosis.
2. **Fix in the worktree** (`/home/u/repo-worktrees/TEP-11_SP-1`): make the timeout propagate — the evidence names the exact failing probe, use it.
3. **Verify at slice grain** via the repo's recipe, in the worktree.
4. **Commit:** `git add -A && git commit -m "fix(attend): TEP-11_SP-1_SL-3 surface transport timeouts"`. No push.
5. **Discovery, out of scope:** the logger double-formats messages elsewhere → `create_slice` under the appropriate Spec, then **return to the fix**.
6. **Hand back:** `move_slice { thinking_space, slice: "TEP-11_SP-1_SL-3", status: "Ready" }` (+ `docs_done: true` if it carried `docs: required` and behaviour changed).
7. **Sign off:** work summary (incl. the commit) → board items created → the hand-back.

## Worked example — Spec rework (rejected Spec)

Invocation: `/attend SP-11/1 …worktree note… the skill never states the worktree is deleted on accept`

1. **Read the Spec.** `get_thinkube_file { thinking_space, relative_path: "teps/TEP-11/SP-1/spec.md" }` + the delivery evidence in the prompt.
2. **Re-align at Spec grain** in the worktree; **verify**; **commit** (`fix(attend): SP-11/1 …`).
3. **Hand back for re-orchestration** — a **handoff** ("this Spec is ready for you to re-run Orchestrate"), never a self-offer, never a status-flip stand-in.
4. **Sign off** with the final block.

## Board-defect fixes — when the code is not the problem

The judged fault may name the gate or the board record, not the code. Fix the record through the sanctioned tools, never by hand-editing thinking-space files:

- **Footprint names a wrong/missing path** → `update_slice` re-cut (`files` / `work_units`; declare genuinely-new files in `creates:`). The existence gate's did-you-mean names the likely intended path.
- **Probe cannot run / is wrong** → re-certify via `write_spec { spec, ac_verifications: {} }` (certify-only: the server re-runs the audit in the working repo and re-signs). The signing-time dry-run refuses commands that cannot execute. If the Spec BODY changed too, the approval hash moved — end by calling `open_review` so the human can re-Approve without asking for the panel.
- **An AC itself is wrong** → `patch_spec_section` on `Acceptance Criteria` (this un-certifies; re-certify after).

## Why evidence is no longer redacted

Earlier revisions stripped the failing AC ordinal, command, and output from this session ("anti-gaming boundary"). That blinded the fixer to exactly the fault classes it most needed to see — an unrunnable probe, a phantom footprint path — while grading independence was already enforced where it belongs: the closing gate's assessor and judge are never the fixer, and they re-grade the committed state on the next orchestration. The fixer now sees everything; the graders stay independent.
