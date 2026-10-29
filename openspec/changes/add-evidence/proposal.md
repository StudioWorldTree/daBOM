# add-evidence

> **ACTIVE BUILD**

## Why

A crib item can hold one `source` string and one `notes` string. A later
brief cannot add a datasheet, a link, or a second thought without
replacing the first. Research and the notes we write about a part need
their own history, stored here, and a way back to the document.

## What

- New capability `bom-evidence`
- A source is its own row: a path or an absolute URL, shared by every item that cites it
- An enrichment is an append-only fact on an item. Posting one does not change item columns
- A thought is an append-only note on an item. It may cite sources. It does not replace `items.notes`
- Read from the item to its documents, and from a document back to the items
- Backfill each distinct non-empty `items.source` into a notebook source and a link. Leave the column in place
- Quotes stay on `quotes`

## Impact

- Capabilities: ADDED `bom-evidence`
- ADRs: will amend `ARCHITECTURE.md` with the evidence decision

## User journey & surfaces

No new UI because the admin crib already reads the API, and this change is the schema and the REST surface those pages can follow later. Working: post a source, an enrichment, and a thought, then read them from the item and from the source. Empty: an item with no evidence returns empty lists. Failed: a missing SKU or a thought that cites a missing source writes nothing.

## Out of scope

- Ingest writing those rows (`add-ingest-evidence`)
- Pulling URLs out of a markdown line (`add-link-extract`)
- A route that copies an enrichment onto an item column. `PATCH /items/{sku}` remains that act
- Quote method rank, price, and vendors (`bom-quotes`)
- Crib pages and the OpenAPI explorer

## Campaign authority

Duke said "activate all" on 2026-10-29 for the `evidence-history` intention. Bounds: sources, enrichments, and thoughts as three stores; history does not overwrite item columns; backfill `items.source` and keep the column; quotes stay separate; no UI; the app does not parse markdown or PDF. This phrase does not widen that scope. Blocked descendants stay PENDING until their dependency has landed.

## Preparation

- Outcome: still valid. No upstream act has landed. The steer on 2026-10-29 locked the three forks this contract uses.
- Anchors: `src/lib/server/db/schema.ts` items (`notes`, `source`) and quotes (append-only, own URL). `src/lib/server/api/app.ts` `DELETE /items/{sku}` deletes quote rows before the item. `src/lib/server/bom.ts` `matchIngestRow` fills null manufacturer, mpn, or source only.
- Living specs: `openspec/specs/bom-quotes/spec.md`, `openspec/specs/bom-ingest/spec.md`. No `bom-evidence` spec yet.
- Authority: the campaign bounds above. Beads could not take the note (remote schema v53, writes blocked).

### Before act (2026-10-29)

- Outcome: still valid. Delta and design match `reviews/2026-10-29-re-advise.md` (Astra accept, R1–R3). No upstream act. No contract edit in this note.
- Authority: campaign grant plus `/run --go`. Banner ACTIVE BUILD. `add-ingest-evidence` and `add-link-extract` stay PENDING.
