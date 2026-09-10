# Design — add-ingest-skills

Steer 2026-09-09. Send-back 2026-09-09 (Fable): the markdown rule
mapped a menu as a BOM. Closed as below.

## HTTP only

The skill's only write is `POST /api/v1/ingest` to a running server
(default `http://localhost:5173/api/v1`). No drizzle, no `data/dabom/`,
no `$lib/server`, no in-process `ingestTree()`. Checkable: grep the
skill dir for those tokens.

## Tree file before POST

The product of extraction is an `IngestRequest` JSON file on disk. The
agent or human reads it. The POST is the commit. No step goes from
source doc to POST without that file.

The parser emits **candidates** (heading, manufacturer if the heading
names one, mpn, notes). The tree is composed from a **selection**: a
named cart section, an argument list of MPNs, or a hand edit of the
tree file. It is not “every `###` with a `PN` row under one root”.

SHOPPING.md as the production kit (`Cart T`) therefore contains the
T4000 SOM and Rogue-T5 and does not contain the AGX Developer Kit or
the rejected carriers.

Price cells in the brief are dropped. Quotes are `add-price-skills`.
`sku` stays absent unless the human names one; the server ladder mints.

## Contract

Tree shape is `IngestNode` from `/.well-known/openapi.json`. One
example tree in SKILL.md; do not paste the field list.

PDF: `pdf2md` then the same candidate → selection path. A helper
script may live under `skills/ingest-hardware/`, not under `src/`.

Tests: include `skills/**` in vitest, or a helper under
`src/lib/skills/` that imports nothing from `$lib/server`. Fixture is
the whole `SHOPPING.md`, not an excerpt.
