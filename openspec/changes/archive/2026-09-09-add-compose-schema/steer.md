# steer add-compose-schema

**When.** 2026-09-09
**Depth.** standard

## Decided

- Floor: buy-floor leaves (user, agreed recommended)
  Why: T4000 must stay a leaf until a foundry is contracted
- Ingest: POST /ingest writes through (user; owned by add-ingest-api)
  Why: skills must not grow a second database
- SKU kebab manufacturer-mpn else name ([AUTO])
- Quote history + preferred flag ([AUTO]; provenance columns on add-price-access)

## Skipped

none

## Feeds change

Schema carries floor on items and keeps nested BOM lines. Default floor
is buy. Explode stops at buy/foundry. Assemble has children. No ingest
route in this change.
