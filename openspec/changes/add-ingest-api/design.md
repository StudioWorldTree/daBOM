# Design — add-ingest-api

Steer 2026-09-09. User activated all recommended forks. ADR-002 left
mint and collision to this change.

## Write-through

`POST /api/v1/ingest` upserts `items` and `bom_lines` in one request.
No draft table. A second identical POST does not duplicate BOM lines
(match on `parentSku` + `childSku`). Quotes are not written here.

JSON tree is the contract. Markdown is a bounded shopping-brief parser
(`###` heading = name, table `PN` / `PN` = mpn). `application/pdf` and
a URL that resolves to PDF are 415; `add-ingest-skills` runs pdf2md
and POSTs markdown.

## Identity

1. Normalize a slug: lowercase, non-alnum → `-`, collapse hyphens, trim.
2. If manufacturer and MPN are both present, match an existing item with
   the same pair (trim, case-insensitive). Seed `t4000-som` wins over a
   minted `nvidia-900-13834-0000-000`.
3. Else if the payload supplies a kebab `sku` that exists, reuse it.
4. Else mint: `{slug(manufacturer)}-{slug(mpn)}` when both exist, else
   `slug(name)`.
5. Minted slug that collides with a *different* identity gets `-2`, `-3`.

Changing seeded PKs is a migration, not ingest.

## Floor

New items default `buy`. A node that lists children is set to
`assemble` *before* lines insert (same 409 door as compose-schema).
Ingest SHALL NOT hang children on an existing `buy` / `foundry` leaf
(409, same as POST `/items/{sku}/bom`).

## Idempotence

Upsert item fields that the payload set. Do not wipe `floor` from
`assemble` to `buy` while children exist. Do not invent quotes from
street prices in the brief.
