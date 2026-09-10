# Learnings

- 2026-09-09 `DEFAULT 'buy'` on `items.floor` would explode every seeded kit to nothing; migration and seed must set `assemble` for any SKU that is a parent in `bom_lines` (`add-compose-schema`).
- 2026-09-09 “latest per vendor” as the first roll-up step would pick a Sep 8 crawl over a Sep 1 API; within a vendor, rank method then newest (`add-price-access`).
- 2026-09-09 a preferred vendor whose chosen row has no price (seed `cti-msg103`) must fall through to method rank or roll-up regresses (`add-price-access`).
- 2026-09-09 PATCH `isPreferred` on a superseded (item, vendor) row is 422; otherwise the flag is invisible to the current row (`add-price-access`).
- 2026-09-09 a March API beating a September crawl is only honest if roll-up carries `asOf` = min `checkedAt` of chosen priced quotes (`add-price-access`).
