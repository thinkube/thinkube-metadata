#!/usr/bin/env node
/**
 * SessionStart hook: stale-cwd-warn (TEP-6).
 *
 * On a RESUME, detect that the session's ORIGINAL working directory is gone — the
 * common case being a spec's git worktree removed when the spec was Accepted
 * (clean-accept deletes the worktree). Such a session is logically finished and
 * would otherwise resume into a recovered/fallback directory (the cwd-wrapper now
 * recovers to the canonical repo instead of the workspace's first folder, but the
 * session is still stale). Surface a warning recommending the user close it and
 * reopen a fresh session from the board.
 *
 * LEGACY SAFETY NET: attend sessions now open in the CANONICAL repo (not the
 * Spec's worktree), so new sessions survive worktree retirement and never
 * strand — there is no close-this-session ritual anymore. This hook remains
 * only for OLD sessions that were opened inside a since-removed worktree and
 * are later resumed. Keep the detection; expect it to fire ever more rarely.
 *
 * Detection-only: Claude Code exposes no model/skill/hook session-termination, so
 * this WARNS (via `additionalContext`); the human (or the host closing the tab)
 * does the actual close.
 *
 * Fail-open & non-blocking by design: every path exits 0 and never emits a
 * blocking verdict, so a quirk here can never wedge session start. stdin is read
 * ASYNC (never `readFileSync(0)`, which has hung sessions before — see hooks.json),
 * with a timeout backstop.
 */
import { existsSync, readFileSync } from "node:fs";

let done = false;

function emit(ctx) {
  if (done) return;
  done = true;
  try {
    if (ctx) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: ctx,
          },
        }),
      );
    }
  } catch {
    /* never throw out of a hook */
  }
  process.exit(0);
}

function analyze(input) {
  try {
    const data = JSON.parse(input || "{}");
    // Only meaningful on resume; a fresh "startup" has no original cwd to lose.
    if (data.source !== "resume") return emit(null);
    const tp = data.transcript_path;
    if (!tp || !existsSync(tp)) return emit(null);
    // The session's original root cwd is the first `"cwd":"…"` recorded in the
    // transcript (chronological). If it no longer exists, the worktree is gone.
    const m = readFileSync(tp, "utf8").match(/"cwd"\s*:\s*"([^"]+)"/);
    const orig = m && m[1];
    if (orig && !existsSync(orig)) {
      return emit(
        `⚠️ This session resumed, but its original working directory no longer exists:\n` +
          `    ${orig}\n` +
          `That almost always means the spec's git worktree was removed when the spec was ` +
          `Accepted (clean-accept deletes the worktree). This session's work is finished — ` +
          `recommend closing it and opening a fresh session from the board for any new work, ` +
          `rather than continuing here in a recovered/fallback directory.`,
      );
    }
    return emit(null);
  } catch {
    return emit(null);
  }
}

let input = "";
try {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", () => analyze(input));
  process.stdin.on("error", () => analyze(input));
} catch {
  analyze("");
}
// Backstop: if stdin never closes, don't hang session start.
setTimeout(() => analyze(input), 3000);
