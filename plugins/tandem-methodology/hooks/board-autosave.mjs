#!/usr/bin/env node
/**
 * Stop hook: board-autosave.
 *
 * Takes commit+push of the board sidecar off the model. At turn end it runs, in
 * the board sidecar working tree:
 *
 *     git add -A  &&  git commit  &&  git pull --rebase  &&  git push
 *
 * so unsaved board state — the committed repo *is* the board, and its host is the
 * only backup — is never left on disk at risk. The same script is meant to be
 * wired to a host cron line / systemd timer as a crashed-session backstop (an
 * ops follow-up, not part of this repo).
 *
 * Fail-open & non-blocking by design. A Stop hook must never wedge the session:
 * every path here exits 0. Diagnostics go to stderr (visible in the hook log);
 * the turn is never blocked, even when there is nothing to save, no remote is
 * configured, or git errors out.
 *
 * Inputs:
 *   stdin                       — the Stop hook JSON payload (currently unused;
 *                                 read and ignored so the hook composes cleanly).
 *   env THINKUBE_BOARD_ROOT     — the board sidecar working tree to autosave.
 *                                 (Falls back to THINKUBE_BOARD_SIDECAR.) When
 *                                 unset, the hook is a no-op — it never touches
 *                                 the code repo it may be running inside.
 *   env THINKUBE_AUTOSAVE_REMOTE — remote name to sync against (default "origin").
 *
 * The whole working tree is staged (`git add -A`, never cherry-picked) so the
 * human's other uncommitted board edits ride along — selective staging would
 * silently drop board state.
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { existsSync, readFileSync } from "node:fs";

/**
 * Resolve the board sidecar to autosave, WITHOUT depending on a per-user env:
 *   1. `THINKUBE_BOARD_ROOT` / `THINKUBE_BOARD_SIDECAR` if set (explicit override);
 *   2. else walk up from cwd for a `.mcp.json` whose kanban-server `env` declares
 *      `THINKUBE_BOARD_ROOT` — the SAME value the MCP server uses, written into
 *      every board-connected repo by the extension installer. So a session editing
 *      the board (which runs from such a repo) auto-resolves its sidecar.
 * Returns "" when no board can be found — the hook then skips harmlessly.
 */
function resolveBoardRoot() {
  const env = process.env.THINKUBE_BOARD_ROOT || process.env.THINKUBE_BOARD_SIDECAR;
  if (env) return env;
  let dir = process.cwd();
  for (let i = 0; i < 40; i++) {
    const mcp = path.join(dir, ".mcp.json");
    if (existsSync(mcp)) {
      try {
        const servers = JSON.parse(readFileSync(mcp, "utf8")).mcpServers || {};
        for (const s of Object.values(servers)) {
          const root = s && s.env && s.env.THINKUBE_BOARD_ROOT;
          if (root) return root;
        }
      } catch {
        /* malformed .mcp.json — keep walking up */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "";
}

/**
 * Run git in `cwd`; never throws — returns {ok, status, stdout, stderr}.
 *
 * Headless-safe: `GIT_TERMINAL_PROMPT=0` (plus empty askpass helpers) makes a
 * real push fail fast instead of blocking on a credential prompt, and the
 * bounded `timeout` guarantees no single git call can wedge the turn.
 */
function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "",
      SSH_ASKPASS: "",
      GIT_PAGER: "cat",
    },
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

function note(msg) {
  process.stderr.write(`[thinkube] board-autosave: ${msg}\n`);
}

/**
 * Autosave the board sidecar at `boardDir`.
 *
 * Returns a small result object describing what happened (useful for tests):
 *   { skipped, reason?, committed, pushed, head? }
 */
export function autosave(boardDir, opts = {}) {
  const remote = opts.remote || process.env.THINKUBE_AUTOSAVE_REMOTE || "origin";
  const now =
    opts.now || (() => new Date().toISOString());

  if (!boardDir) {
    return { skipped: true, reason: "no board dir configured" };
  }

  // Must be (inside) a git work tree, and resolve to its top level.
  const top = git(boardDir, ["rev-parse", "--show-toplevel"]);
  if (!top.ok || !top.stdout) {
    return { skipped: true, reason: `not a git work tree: ${boardDir}` };
  }
  const root = top.stdout;

  // Stage the whole tree — never cherry-pick paths.
  const add = git(root, ["add", "-A"]);
  if (!add.ok) {
    return { skipped: true, reason: `git add failed: ${add.stderr}` };
  }

  // Commit only if the index has changes (avoid empty commits / churn).
  const dirty = git(root, ["diff", "--cached", "--quiet"]); // status 1 => changes
  let committed = false;
  if (dirty.status === 1) {
    const msg = `board: autosave ${now()}`;
    const commit = git(root, ["commit", "--no-verify", "-m", msg]);
    if (!commit.ok) {
      return { skipped: false, committed: false, reason: `git commit failed: ${commit.stderr}` };
    }
    committed = true;
  }

  const head = git(root, ["rev-parse", "HEAD"]).stdout || null;

  // Only sync if the named remote exists.
  const remotes = git(root, ["remote"]).stdout.split(/\r?\n/).filter(Boolean);
  if (!remotes.includes(remote)) {
    return { skipped: false, committed, pushed: false, head, reason: `no remote "${remote}"` };
  }

  // pull --rebase, but only if the upstream/branch already exists on the remote;
  // otherwise the first push establishes it.
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout;
  const remoteHasBranch =
    branch && branch !== "HEAD"
      ? git(root, ["ls-remote", "--heads", remote, branch]).stdout !== ""
      : false;
  if (remoteHasBranch) {
    const pull = git(root, ["pull", "--rebase", remote, branch]);
    if (!pull.ok) {
      // Don't push over a failed rebase; leave the tree as git left it.
      git(root, ["rebase", "--abort"]);
      return {
        skipped: false,
        committed,
        pushed: false,
        head,
        reason: `git pull --rebase failed: ${pull.stderr}`,
      };
    }
  }

  // Push (sets upstream on first push).
  const pushArgs = branch && branch !== "HEAD"
    ? ["push", "-u", remote, branch]
    : ["push", remote, "HEAD"];
  const push = git(root, pushArgs);
  if (!push.ok) {
    return { skipped: false, committed, pushed: false, head, reason: `git push failed: ${push.stderr}` };
  }

  return { skipped: false, committed, pushed: true, head };
}

function main() {
  // We deliberately DO NOT read stdin. The Stop payload is unused, and a
  // blocking `readFileSync(0)` wedges forever under the harness's open stdin
  // pipe (this is exactly what hung the first headless orchestration). Skipping the read is the headless-safe choice; the
  // pipe is simply left for the OS to close when we exit.

  const boardDir = resolveBoardRoot();

  let result;
  try {
    result = autosave(boardDir ? path.resolve(boardDir) : "");
  } catch (e) {
    note(`unexpected error: ${e && e.message ? e.message : e}`);
    process.exit(0); // never block the turn
  }

  if (result.skipped) {
    note(`skipped — ${result.reason}`);
  } else if (result.reason) {
    note(result.reason);
  } else {
    note(
      `${result.committed ? "committed" : "nothing to commit"}` +
        `${result.pushed ? " + pushed" : ""}` +
        `${result.head ? ` (${result.head.slice(0, 8)})` : ""}`,
    );
  }
  process.exit(0); // Stop hooks: always allow the turn to end.
}

// Run only when invoked directly (not when imported by a test).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  main();
}
