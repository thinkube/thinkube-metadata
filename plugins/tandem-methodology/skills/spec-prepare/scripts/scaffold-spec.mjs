#!/usr/bin/env node
// scaffold-spec.mjs — emit the canonical Tandem spec body to stdout.
//
// Reads the single-source template asset
//   skills/spec-prepare/assets/spec-template.md
// and prints it verbatim. The template carries the four load-bearing
// headers, in order:
//   ## Acceptance Criteria
//   ## Constraints
//   ## Design
//   ## File Structure Plan
//
// This script is read/transform/emit-to-stdout only — it never writes
// board files (the secret-scan boundary stays in the MCP server).
//
// Usage:
//   node skills/spec-prepare/scripts/scaffold-spec.mjs
//
// Exit codes:
//   0  template read and emitted to stdout
//   1  template asset missing or unreadable

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve the template relative to THIS script, not the caller's cwd,
// so the scaffold works regardless of where the session is rooted.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(scriptDir, "..", "assets", "spec-template.md");

async function main() {
  let body;
  try {
    body = await readFile(templatePath, "utf8");
  } catch (err) {
    process.stderr.write(
      `scaffold-spec: cannot read template asset at ${templatePath}: ${err.message}\n`,
    );
    process.exit(1);
  }

  // Emit verbatim. Guarantee a single trailing newline.
  process.stdout.write(body.endsWith("\n") ? body : body + "\n");
}

main();
