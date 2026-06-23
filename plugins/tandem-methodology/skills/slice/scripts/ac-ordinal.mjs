#!/usr/bin/env node
// ac-ordinal.mjs — enumerate the 1-based Acceptance-Criteria ordinals of a spec body.
//
// Reads a Spec body (Tandem shape) and emits one record per criterion under the
// `## Acceptance Criteria` header, numbered 1..N in document order. This is the
// deterministic half of /slice step 4: the *ordinal ↔ AC text* enumeration is rote
// (counting list items), while the *ordinal → slice* mapping stays model judgment.
//
// Read/transform/emit-to-stdout only — never writes board files.
//
// Usage:
//   node ac-ordinal.mjs [FILE]        # FILE, or stdin when omitted / "-"
//   node ac-ordinal.mjs --json [FILE] # emit a JSON array instead of TSV
//   node ac-ordinal.mjs --count [FILE]# emit only the AC count (N)
//
// Output (default): one `<ordinal>\t<text>` line per AC, ordinals 1..N.
// Exit status: 0 when ≥1 AC is enumerated; 1 when the header is absent or holds
// zero criteria; 2 on a usage / IO error.

import { readFileSync } from "node:fs";

const AC_HEADER = "## Acceptance Criteria";

function usage(stream = process.stdout) {
  stream.write(
    "Usage: node ac-ordinal.mjs [--json|--count] [FILE]\n" +
      "  Enumerate the 1-based Acceptance-Criteria ordinals of a Spec body.\n" +
      "  FILE defaults to stdin (also when FILE is '-').\n",
  );
}

function fail(msg, code = 2) {
  process.stderr.write(`ac-ordinal: ${msg}\n`);
  process.exit(code);
}

// Parse CLI: at most one mode flag and at most one positional FILE.
let mode = "tsv";
let file = null;
for (const arg of process.argv.slice(2)) {
  if (arg === "--json") mode = "json";
  else if (arg === "--count") mode = "count";
  else if (arg === "-h" || arg === "--help") {
    usage();
    process.exit(0);
  } else if (arg === "-") {
    file = null; // explicit stdin
  } else if (arg.startsWith("--")) {
    usage(process.stderr);
    fail(`unknown option: ${arg}`);
  } else if (file === null && arg !== "") {
    file = arg;
  } else {
    fail(`unexpected extra argument: ${arg}`);
  }
}

let source;
try {
  source = readFileSync(file ?? 0, "utf8");
} catch (err) {
  fail(`cannot read ${file ? `'${file}'` : "stdin"}: ${err.message}`);
}

// Locate the `## Acceptance Criteria` section: from its header line up to the next
// `#`-level heading (any depth) or EOF. Header match tolerates trailing whitespace.
const lines = source.split(/\r?\n/);
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].replace(/\s+$/, "") === AC_HEADER) {
    start = i + 1;
    break;
  }
}
if (start === -1) {
  fail(`no '${AC_HEADER}' header found`, 1);
}

const section = [];
for (let i = start; i < lines.length; i++) {
  if (/^#{1,6}\s/.test(lines[i])) break; // next heading ends the section
  section.push(lines[i]);
}

// Within the section, each top-level (non-indented) list item is one AC. A leading
// `[ ]` / `[x]` checkbox marker is stripped. Indented continuation lines fold into
// the current AC's text so a multi-line criterion enumerates as one ordinal.
const TOP_ITEM = /^[-*+]\s+(.*)$/;
const CHECKBOX = /^\[[ xX]\]\s*/;
const acs = [];
for (const raw of section) {
  const top = TOP_ITEM.exec(raw);
  if (top) {
    acs.push(top[1].replace(CHECKBOX, ""));
  } else if (acs.length > 0 && /^\s+\S/.test(raw)) {
    // indented continuation of the current AC
    acs[acs.length - 1] += " " + raw.trim();
  }
  // blank lines and stray non-list prose are ignored
}

const items = acs.map((text, idx) => ({
  ordinal: idx + 1,
  text: text.replace(/\s+/g, " ").trim(),
}));

if (items.length === 0) {
  fail(`'${AC_HEADER}' section contains no acceptance criteria`, 1);
}

if (mode === "count") {
  process.stdout.write(`${items.length}\n`);
} else if (mode === "json") {
  process.stdout.write(JSON.stringify(items, null, 2) + "\n");
} else {
  for (const { ordinal, text } of items) {
    process.stdout.write(`${ordinal}\t${text}\n`);
  }
}
process.exit(0);
