# add-link-extract

> **ACTIVE BUILD**

**Rigor:** change

## Why

The ingest parser strips markdown links down to their anchor text, so a URL written on a cart line never reaches the tree. The evidence stores can hold that URL only if the tree names it. The tree file is still the place a person sees the selection before it is posted.

## What

- Capability `ingest-skills`
- On each selected line, the composer adds a `sources` entry for every markdown link URL and every bare `http`/`https` URL on that line
- Price text stays dropped. A URL is never invented. A URL that appears only on a part the selection rejected stays out
- A hand edit of the tree file may remove an entry before POST
- The skill's only write is still POST `/api/v1/ingest`. It does not POST `/sources` or `/enrichments` itself

## Impact

- Capabilities: ADDED behavior on `ingest-skills`
- ADRs: none

## User journey & surfaces

No new UI because the review surface is the JSON tree file the skill already writes. Working: a selected line with one URL produces a `sources` entry. Empty: a line with no URL has no `sources` entry. The person can delete an entry in the file and the POST sends the file they saved.

## Out of scope

- Evidence tables (`add-evidence`)
- The ingest transaction that stores `sources` (`add-ingest-evidence`)
- Parsing PDF bytes. A datasheet still goes through `pdf2md` first
- Choosing an MPN when a line has two part numbers

## Campaign authority

Same grant as `add-evidence`. `add-ingest-evidence` has landed, so this banner is ACTIVE BUILD.

## Preparation

- Outcome: revised in one place the steer left open. The open fork was "every URL on a selected line" versus "a hand-picked list". Both stand: compose includes every URL on the selected line, and the tree file remains editable before POST. That is the existing review step, not a new store. Recorded here because beads writes are blocked.
- Anchors: `skills/ingest-hardware/lib/candidates.ts` `plain()` strips links. `skills/ingest-hardware/lib/compose.ts` `nodeFor` sets `source` to the document path and drops prices. `openspec/specs/ingest-skills/spec.md`.
- Not dispatchable until `add-ingest-evidence` has landed and the ingest body accepts `sources`.

### Before act (2026-10-28)

- Outcome: still valid. No contract edit.
- Upstream: `add-ingest-evidence` folded at `7ac2342`. `IngestNode.sources` is optional `{ kind?, locator }[]` on the ingest schema. The server stores that array as links. The skill still only POSTs `/api/v1/ingest`.
- Authority: "activate all" plus `/run --go`. This node is dependency-ready.
