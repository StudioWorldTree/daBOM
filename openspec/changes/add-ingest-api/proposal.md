# add-ingest-api

> **ACTIVE BUILD**

## Why

Agents ingesting a shopping brief or datasheet must write a nested BOM
through REST. There is no draft store and no skill-side SQL. Without
POST `/ingest`, every SKU is hand-authored.

## What

- `POST /api/v1/ingest` writes through existing items + `bom_lines`
- Accept JSON tree (the contract) and markdown shopping-brief text
- PDF is 415 — skills convert with pdf2md (`add-ingest-skills`)
- Mint SKU from manufacturer+MPN slug, else name; match existing identity
- Parents that receive children get `floor=assemble`; new leaves default `buy`
- Capability: `bom-ingest`
- Skills stay HTTP clients (`add-ingest-skills`)

## Impact

- Capabilities: ADDED `bom-ingest`
- ADRs: will amend ARCHITECTURE.md at fold (mint + collision)

## User journey & surfaces

No new UI because ingest is an OpenAPI operation; the crib already lists
the items it writes. Explorer / `app.request` is the try surface.

## Out of scope

- Repo skills (`add-ingest-skills`)
- Catalog floor retag (`add-floor-seed`)
- Quote fetch (`add-price-skills`)
- LLM extraction
- Changing seeded primary keys
