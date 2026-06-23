# Example well-shaped spec

A short narrative paragraph describing the documented unit of work. This fixture
exists so `validate-spec-shape.mjs` has a known-good body to pass; the gate
derives the failing fixtures by removing one of the four headers below.

## Acceptance Criteria

- [ ] A representative, AI-verifiable criterion the slice satisfies — verified by
  running its declared command and asserting the expected result.

## Constraints

- Repo-relative everything; scripts read/transform/emit-to-stdout only.

## Design

The approach in prose: what runs, where, and why this shape is the simplest one
that satisfies the acceptance criteria.

## File Structure Plan

- `path/to/file.mjs` — what it does.
