# Learnings

- 2026-09-09 `DEFAULT 'buy'` on `items.floor` would explode every seeded kit to nothing; migration and seed must set `assemble` for any SKU that is a parent in `bom_lines` (`add-compose-schema`).
- 2026-09-09 “latest per vendor” as the first roll-up step would pick a Sep 8 crawl over a Sep 1 API; within a vendor, rank method then newest (`add-price-access`).
- 2026-09-09 a preferred vendor whose chosen row has no price (seed `cti-msg103`) must fall through to method rank or roll-up regresses (`add-price-access`).
- 2026-09-09 PATCH `isPreferred` on a superseded (item, vendor) row is 422; otherwise the flag is invisible to the current row (`add-price-access`).
- 2026-09-09 a March API beating a September crawl is only honest if roll-up carries `asOf` = min `checkedAt` of chosen priced quotes (`add-price-access`).
- 2026-09-09 promoting an existing `buy` parent on ingest would both explode a SOM and 409 it; promotion is new nodes only (`add-ingest-api`).
- 2026-09-09 a supplied sku is a reference: an incoming node with no (manufacturer, mpn) pair never collides, or `sku: t4000-som` with no MPN 409s the seed (`add-ingest-api`).
- 2026-09-09 name-minted `status` default must live on the ingest node schema; `ItemCreateSchema`'s `candidate` would mark brief lines as authored (`add-ingest-api`).
- 2026-09-09 a seed backfill that sets `assemble` for every `bom_lines` parent would mask an untagged catalog row; the catalog test must import `seedItems`/`seedBoms` with no DB (`add-floor-seed`).
- 2026-09-09 `NewItem` from `$inferInsert` makes `floor` optional because of the column default; `SeedItem` must require `'buy' | 'assemble'` or an untagged row typechecks (`add-floor-seed`).
- 2026-09-09 in-house resin shells stay `buy` until resin plus labor are children; empty `assemble` rolls up to zero and drops the quote (`add-floor-seed`).
