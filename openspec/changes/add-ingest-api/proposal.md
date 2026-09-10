# add-ingest-api

> **ACTIVE BUILD**

## Why

Agents ingesting a shopping brief or datasheet must write a nested BOM
through REST. There is no draft store and no skill-side SQL. Without
POST `/ingest`, every SKU is hand-authored.

## What

- `POST /api/v1/ingest` writes through existing items + `bom_lines` in one transaction
- JSON tree is the contract. Markdown/PDF are 415 (`add-ingest-skills`)
- Identity: pair match, MPN-only, supplied sku, then mint; different identity is 409
- Matched seed rows are not overwritten; fill nulls only
- Parents that receive children get `floor=assemble` if new or buy; foundry stays 409
- 201 echoes sku + `created|matched` + line ids
- Capability: `bom-ingest`
- Skills stay HTTP clients (`add-ingest-skills`)

## Impact

- Capabilities: ADDED `bom-ingest`
- ADRs: will amend ARCHITECTURE.md at fold (mint + collision)

## User journey & surfaces

No new UI because ingest is an OpenAPI operation; the crib already lists
the items it writes. Explorer / `app.request` is the try surface.

## Out of scope

- Repo skills and markdown/PDF parsers (`add-ingest-skills`)
- Catalog floor retag (`add-floor-seed`)
- Quote fetch (`add-price-skills`)
- LLM extraction
- Changing seeded primary keys
- Numeric SKU suffixes (`-2`)
