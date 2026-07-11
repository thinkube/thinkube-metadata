#!/usr/bin/env node
/**
 * lint-docs — doc referential integrity for the tandem-methodology plugin.
 *
 * Invocation (no package.json here, so run it directly):
 *
 *     node scripts/lint-docs.mjs
 *
 * (from plugins/tandem-methodology/; any cwd works — paths resolve from this
 * script's own location.)
 *
 * Scans every *.md under the plugin root and FAILS (exit 1, listing each
 * violation as file:line) when a doc references a retired skill or a retired
 * id scheme. The check is deliberately CURATED, not generic: a blanket
 * "/word must be a skill" matcher would false-positive on ordinary paths
 * (`/home/...`, `/tmp/...`), so the list below names exactly the tokens known
 * to be retired. A skill token is only a violation when no
 * skills/<name>/SKILL.md exists — if someone revives the skill, the lint
 * self-heals.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Known-retired skill references. `skill` is checked against
 * skills/<skill>/SKILL.md — existence exonerates the token.
 * `re` must carry the `g` flag (matchAll) and no `m`-anchors it doesn't need.
 */
const RETIRED_SKILL_TOKENS = [
  { label: "/pair-next", skill: "pair-next", re: /\/pair-next\b/g },
  { label: "skills/pair-next", skill: "pair-next", re: /\bskills\/pair-next\b/g },
  { label: "pair_next", skill: "pair-next", re: /\bpair_next\b/g },
  { label: "/pair-start", skill: "pair-start", re: /\/pair-start\b/g },
  { label: "skills/pair-start", skill: "pair-start", re: /\bskills\/pair-start\b/g },
  // "/board" only with a following space, backtick, comma, or line end, so
  // paths like "/board-autosave.mjs" or "a/board/x" don't false-positive.
  { label: "/board", skill: "board", re: /\/board(?=[ `,.)]|$)/gm },
  { label: "skills/board", skill: "board", re: /\bskills\/board\b/g },
];

/** Retired id-scheme vocabulary — forbidden outright (describe only what IS). */
const FORBIDDEN_TOKENS = [
  { label: "base36", re: /base36/gi },
  { label: "epoch id", re: /epoch id/gi },
  // One naming convention (TEP-14): space names use the workspace spelling
  // (Platform/core/…) — the disk-path spelling and the "home-relative"
  // vocabulary are retired.
  { label: "thinkube-platform/ (disk-path spelling)", re: /thinkube-platform\//g },
  { label: "home-relative (retired vocabulary)", re: /home-relative/gi },
];

function skillExists(name) {
  return existsSync(join(PLUGIN_ROOT, "skills", name, "SKILL.md"));
}

function* mdFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* mdFiles(p);
    } else if (entry.endsWith(".md")) {
      yield p;
    }
  }
}

const violations = [];
for (const file of mdFiles(PLUGIN_ROOT)) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const checks = [
    ...RETIRED_SKILL_TOKENS.filter((t) => !skillExists(t.skill)),
    ...FORBIDDEN_TOKENS,
  ];
  lines.forEach((line, i) => {
    for (const check of checks) {
      check.re.lastIndex = 0;
      if (check.re.test(line)) {
        violations.push(
          `${relative(PLUGIN_ROOT, file)}:${i + 1}: retired token "${check.label}" — ${line.trim().slice(0, 120)}`,
        );
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`lint-docs: ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nRetired skills/schemes must not be referenced — describe only the current mechanism " +
      "(Orchestrate board action, /thinking-space snapshot, the Done gate).",
  );
  process.exit(1);
}
console.log("lint-docs: OK — no retired skill or id-scheme references.");
