# Design — add-ingest-api

Steer 2026-09-09. User activated all recommended forks. ADR-002 left
mint and collision to this change. Send-back 2026-09-09 (Fable): holes
1–4 closed as below.

## Write-through

`POST /api/v1/ingest` upserts `items` and `bom_lines` in **one
transaction**. No draft table. Any non-2xx rolls the whole tree back
(zero orphan rows). Quotes are not written here.

JSON tree is the only body. `application/json` required. Markdown,
PDF, and a URL that resolves to either are 415; `add-ingest-skills`
turns a shopping brief into this tree (pdf2md then JSON). The Thor
acceptance fixture is a JSON tree of the T4000 + Rogue-T5 kit, not
the markdown file.

Re-POST of the same tree matches `bom_parent_child_role_uidx`
`(parent, child, role)` and **sets** qty (does not add). No duplicate
lines.

## Slug

One function. Lowercase. Unicode: NFKD, strip combining marks, drop
any remaining non-ASCII. Non-alphanumerics become `-`, collapse
repeats, trim leading/trailing `-`. Empty result is 422. The slug
MUST match `^[a-z0-9][a-z0-9-]*$` (ADR-002) or the node is 422.

## Identity (in this order)

For each node:

1. **Pair match.** If manufacturer and MPN are both non-null, find an
   existing row with the same pair (trim, case-insensitive). Reuse that
   SKU even if the payload supplied a different one. `action: matched`.
2. **MPN-only match.** If manufacturer is null and MPN is set: exactly
   one existing row with that MPN → match; two or more → 409.
3. **Supplied sku.** If the payload has a kebab `sku`:
   - exists, no manufacturer/mpn on that row → same identity, match
   - exists with a _different_ pair → 409 naming the sku
   - does not exist → create as given (`action: created`). 422 if not kebab
4. **Mint.** `{slug(manufacturer)}-{slug(mpn)}` when both exist, else
   `slug(name)`.
   - minted slug exists, existing row has no pair (or the same pair) →
     match (name-minted idempotency)
   - minted slug exists with a _different_ identity → 409, no `-2` suffix

Matched rows are not overwritten. Fill nulls only (`manufacturer`,
`mpn`, `source`). Name, kind, category, status, floor stay. Floor
promotion below is the only floor write on a matched row.

Name-minted creates: `source` = the ingest source string; `status`
defaults to `placeholder` unless the payload set one. That default lives
on the ingest node schema, not `ItemCreateSchema` — `POST /items` still
defaults to `candidate`, because a human typed that row.

Step 3 note: a supplied `sku` is a _reference_. An incoming node with no
`(manufacturer, mpn)` pair claims no identity, so it never collides with
the referenced row's pair; it matches. A minted slug is a _guess_, so
landing on a row that carries a pair is 409.

A later manufacturer+mpN on a name-minted row is PATCH `/items/{sku}`,
never a re-mint.

## Floor

New items default `buy`. A node that lists children: if it is **new**,
set `assemble` before lines insert. Promotion never touches an existing
row — an existing `buy` or `foundry` parent with children in the payload
is 409 (do not retag, do not promote). Ingest SHALL NOT hang children on
an existing `buy` / `foundry` leaf (409). Do not wipe `assemble` to
`buy` while children exist. Do not retag seed floors except the node
being ingested.

## Lines

Lines insert through `addBomLine` with the transaction handle, so the
floor guard, `wouldCycle` and the `(parent, child, role)` unique index
are the same doors a single-line POST goes through. A cycle closed by a
`sku` reference is 409 and rolls the tree back. A line that already
exists on `(parent, child, role)` is updated, not re-inserted.

## Response

201 body echoes the tree. Each node has `sku`, `action` (`created` |
`matched`), `floor`, and `lines[]` with line ids. 409/422 write
nothing.

## Not this change

Markdown/PDF parsers. `-2` suffixes. Quote rows. Seed PK migrations.
