# add-compose-schema

> **ACTIVE BUILD**

## Why

part/assembly/kit cannot say “stop here, we buy this.” Agents ingesting
hardware will explode a SOM into a die unless the floor is in the schema.

## What

- Nested BOM stays parent/child lines; floor is a field on the item
- Default floor: catalog buys we cannot fabricate (SOM, carrier, complete camera, turret/module, switch). Kits assemble. T4000 SOM is a leaf. Raise floor per SKU when that process is contracted
- SKU kebab: manufacturer-mpn when present, else name slug
- Capability: `bom-compose`
- Ingest route is `add-ingest-api`; this change is the tables and OpenAPI item/BOM shape it will write

## Impact

- Capabilities: ADDED `bom-compose`
- ADRs: will amend ARCHITECTURE.md when folded (floor + SKU)

## User journey & surfaces

No new UI because the crib already lists items and BOMs; floor is a field on `GET /api/v1/items/{sku}` and explode still uses `/bom`.

## Out of scope

- POST /ingest (`dabom-ingest-api` / `add-ingest-api`)
- Retagging the seed catalog (`dabom-floor-seed` / `add-floor-seed`)
- Quote fetch ladder (`add-price-access`)
- Repo skills (`add-ingest-skills`)
