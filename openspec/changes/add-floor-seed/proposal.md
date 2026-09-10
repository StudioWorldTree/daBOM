# add-floor-seed

> **ACTIVE BUILD**

## Why

Compose-schema backfills `assemble` for whoever is a parent in
`bom_lines` and defaults everyone else to `buy`. The crib still does
not *say* that T4000, Rogue-T5, PYXIS, RV1126B turret/core, and the
PoE switch are buy leaves. Agents will invent a die under the SOM
unless the seed names the floor.

## What

- Put `floor` on every seeded item in `catalog.ts`
- Buy leaves: SOM, carrier, complete camera, turret/module, switch
- Assemble: kits and sandwiches that already have children
- T4000 SOM stays a leaf. No die. Raise floor per SKU when contracted
- Capability: MODIFIED `bom-compose` (seed, not schema)

## Impact

- Capabilities: MODIFIED `bom-compose`
- ADRs: none (ADR-001 already decided floor)

## User journey & surfaces

No new UI because GET `/api/v1/items/{sku}` already returns `floor`
and explode already stops at buy.

## Out of scope

- POST `/ingest` (`add-ingest-api`)
- Changing seeded SKU strings
- Foundry-level breakdowns
- Quote refresh
