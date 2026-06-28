#!/usr/bin/env node
// validate-spec-shape.mjs — assert a spec body carries the four load-bearing
// headers, in canonical order. Read-only: it reads a body and signals via exit
// code (0 = well-shaped, non-zero = missing/out-of-order header). It never
// writes thinking-space files.
//
// Usage:
//   node validate-spec-shape.mjs <path/to/spec-body.md>
//   cat spec-body.md | node validate-spec-shape.mjs
//
// The four headers must appear as level-2 ATX headings in this order:
const REQUIRED_HEADERS = [
  "## Acceptance Criteria",
  "## Constraints",
  "## Design",
  "## File Structure Plan",
];

import { readFileSync } from "node:fs";

function readInput() {
  const arg = process.argv[2];
  if (arg && arg !== "-") {
    return readFileSync(arg, "utf8");
  }
  // Fall back to stdin (fd 0).
  return readFileSync(0, "utf8");
}

function headerLines(body) {
  // A header "line" is a line whose trimmed-right form exactly equals one of
  // the required headers. We match on the normalized line so trailing
  // whitespace doesn't defeat the check, but we don't treat "## Designs" as
  // "## Design".
  return body.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
}

function validate(body) {
  const lines = headerLines(body);
  const missing = [];
  const positions = {};

  for (const header of REQUIRED_HEADERS) {
    const idx = lines.indexOf(header);
    if (idx === -1) {
      missing.push(header);
    } else {
      positions[header] = idx;
    }
  }

  if (missing.length > 0) {
    return { ok: false, reason: `missing header(s): ${missing.join(", ")}` };
  }

  // All present — check they appear in canonical order.
  const order = REQUIRED_HEADERS.map((h) => positions[h]);
  for (let i = 1; i < order.length; i++) {
    if (order[i] <= order[i - 1]) {
      return {
        ok: false,
        reason:
          `headers out of order: expected ` + REQUIRED_HEADERS.join(" → "),
      };
    }
  }

  return { ok: true };
}

function main() {
  let body;
  try {
    body = readInput();
  } catch (err) {
    process.stderr.write(
      `validate-spec-shape: cannot read input: ${err.message}\n`,
    );
    process.exit(2);
  }

  const result = validate(body);
  if (result.ok) {
    process.exit(0);
  }
  process.stderr.write(`validate-spec-shape: ${result.reason}\n`);
  process.exit(1);
}

main();
